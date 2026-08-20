import { db } from "@/db";
import {
  forecastRuns,
  forecasts,
  products,
  saleItems,
  sales,
} from "@/db/schema";

import type {
  ForecastResponse,
  PredictResponse,
  SalesHistoryPoint,
} from "@/services/ml";

import { and, asc, desc, eq, lt, notInArray, sql, sum } from "drizzle-orm";

import type {
  ForecastAccuracyRow,
  ForecastAccuracyStatus,
  ForecastProductOption,
  ForecastRunSummary,
  StoredForecastPoint,
} from "./types";

/** All products, alphabetically — options for the forecast picker. */
export async function listForecastProducts(): Promise<ForecastProductOption[]> {
  return db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .orderBy(asc(products.name));
}

export async function getProductById(productId: string) {
  const rows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Aggregate daily sales per product — the exact history shape the ML
 * service expects. Days without sales are simply absent; the service treats
 * them as zero demand (matching the sales ledger convention).
 */
export async function getDailySalesHistory(
  productId: string,
): Promise<SalesHistoryPoint[]> {
  const day = sql<string>`${sales.saleDate}::date`;
  const rows = await db
    .select({ date: day, quantity: sum(saleItems.quantity) })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(eq(saleItems.productId, productId))
    .groupBy(day)
    .orderBy(day);

  return rows.map((row) => ({
    date: row.date,
    quantity: Number(row.quantity ?? 0),
  }));
}

/**
 * Persist one forecast run and its points atomically:
 *
 * 1. insert the run record (drives the forecast history UI),
 * 2. delete stored points the new run no longer covers (e.g. a shorter
 *    horizon than the previous run),
 * 3. upsert the new points — one row per (product, date), so re-forecasting
 *    a date replaces the old record instead of duplicating it.
 *
 * Returns the created run id.
 */
export async function saveForecastRun(
  productId: string,
  response: ForecastResponse | PredictResponse,
  userId?: string | null,
): Promise<string> {
  const confidence = response.metrics.confidence_score.toFixed(2);
  const dates = response.points.map(
    (point) => new Date(`${point.date}T00:00:00.000Z`),
  );

  return db.transaction(async (tx) => {
    const [run] = await tx
      .insert(forecastRuns)
      .values({
        productId,
        userId: userId ?? null,
        model: response.model,
        horizonDays: response.horizon_days,
        confidenceScore: confidence,
      })
      .returning({ id: forecastRuns.id });

    await tx
      .delete(forecasts)
      .where(
        dates.length > 0
          ? and(
              eq(forecasts.productId, productId),
              notInArray(forecasts.forecastDate, dates),
            )
          : eq(forecasts.productId, productId),
      );

    if (dates.length > 0) {
      await tx
        .insert(forecasts)
        .values(
          response.points.map((point, index) => ({
            productId,
            runId: run.id,
            forecastDate: dates[index],
            predictedDemand: String(point.predicted_demand),
            lowerBound:
              point.lower_bound != null ? String(point.lower_bound) : null,
            upperBound:
              point.upper_bound != null ? String(point.upper_bound) : null,
            confidenceScore: confidence,
          })),
        )
        .onConflictDoUpdate({
          target: [forecasts.productId, forecasts.forecastDate],
          set: {
            runId: sql.raw(`excluded."runId"`),
            predictedDemand: sql.raw(`excluded."predictedDemand"`),
            lowerBound: sql.raw(`excluded."lowerBound"`),
            upperBound: sql.raw(`excluded."upperBound"`),
            confidenceScore: sql.raw(`excluded."confidenceScore"`),
          },
        });
    }

    return run.id;
  });
}

/** Stored forecasts for a product, ordered by forecast date. */
export async function getStoredForecasts(
  productId: string,
): Promise<StoredForecastPoint[]> {
  const rows = await db
    .select({
      id: forecasts.id,
      date: forecasts.forecastDate,
      predictedDemand: forecasts.predictedDemand,
      lowerBound: forecasts.lowerBound,
      upperBound: forecasts.upperBound,
    })
    .from(forecasts)
    .where(eq(forecasts.productId, productId))
    .orderBy(asc(forecasts.forecastDate));

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    predictedDemand: Number(row.predictedDemand),
    lowerBound: row.lowerBound != null ? Number(row.lowerBound) : null,
    upperBound: row.upperBound != null ? Number(row.upperBound) : null,
  }));
}

/** Previous forecast runs for a product, newest first. */
export async function getForecastRuns(
  productId: string,
  limit = 10,
): Promise<ForecastRunSummary[]> {
  const rows = await db
    .select({
      id: forecastRuns.id,
      model: forecastRuns.model,
      horizonDays: forecastRuns.horizonDays,
      confidenceScore: forecastRuns.confidenceScore,
      generatedAt: forecastRuns.createdAt,
    })
    .from(forecastRuns)
    .where(eq(forecastRuns.productId, productId))
    .orderBy(desc(forecastRuns.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    confidenceScore: Number(row.confidenceScore),
  }));
}

/** MAPE thresholds: < 10% good, 10–20% acceptable, anything worse is poor. */
function accuracyStatus(mape: number): ForecastAccuracyStatus {
  if (mape < 10) return "good";
  if (mape <= 20) return "acceptable";
  return "poor";
}

/**
 * Score every forecast run against the actual sales that landed inside its
 * horizon window. Only days that have fully passed are compared, and a day
 * without sales counts as zero demand (matching the sales-ledger convention).
 * MAPE and bias average over days with actual sales (division by zero demand
 * is undefined); runs with no such day are dropped entirely. Newest first.
 *
 * Note: re-forecasting a (product, date) reassigns the stored point to the
 * newer run, so a run is only scored on the points it still owns.
 */
export async function getForecastAccuracy(): Promise<ForecastAccuracyRow[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Actual units sold per product per day — days without sales are absent.
  const dailyActuals = db
    .select({
      productId: saleItems.productId,
      date: sql<string>`${sales.saleDate}::date`,
      quantity: sql<number>`sum(${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .groupBy(saleItems.productId, sql`${sales.saleDate}::date`)
    .as("daily_actuals");

  const rows = await db
    .select({
      runId: forecastRuns.id,
      productId: forecastRuns.productId,
      productName: products.name,
      model: forecastRuns.model,
      horizonDays: forecastRuns.horizonDays,
      predictedDemand: forecasts.predictedDemand,
      actualQuantity: dailyActuals.quantity,
    })
    .from(forecastRuns)
    .innerJoin(products, eq(forecastRuns.productId, products.id))
    .innerJoin(forecasts, eq(forecasts.runId, forecastRuns.id))
    .leftJoin(
      dailyActuals,
      and(
        eq(dailyActuals.productId, forecastRuns.productId),
        eq(dailyActuals.date, sql<string>`${forecasts.forecastDate}::date`),
      ),
    )
    .where(lt(forecasts.forecastDate, startOfToday))
    .orderBy(desc(forecastRuns.createdAt), asc(products.name));

  // Bucket day-level rows by run (insertion order = the ORDER BY above).
  const runMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      model: string;
      horizonDays: number;
      days: { predicted: number; actual: number }[];
    }
  >();

  for (const row of rows) {
    let run = runMap.get(row.runId);
    if (!run) {
      run = {
        productId: row.productId,
        productName: row.productName,
        model: row.model,
        horizonDays: row.horizonDays,
        days: [],
      };
      runMap.set(row.runId, run);
    }
    run.days.push({
      // Decimal columns/aggregates arrive as strings — normalize once here.
      predicted: Number(row.predictedDemand),
      actual: row.actualQuantity === null ? 0 : Number(row.actualQuantity),
    });
  }

  const accuracy: ForecastAccuracyRow[] = [];

  for (const [runId, run] of runMap) {
    const scoredDays = run.days.filter((day) => day.actual > 0);
    // No actual sales in the window — MAPE/bias would be undefined.
    if (scoredDays.length === 0) continue;

    const mape =
      Math.round(
        (scoredDays.reduce(
          (total, d) => total + Math.abs(d.actual - d.predicted) / d.actual,
          0,
        ) /
          scoredDays.length) *
          1000,
      ) / 10;

    const bias =
      Math.round(
        (scoredDays.reduce(
          (total, d) => total + (d.predicted - d.actual) / d.actual,
          0,
        ) /
          scoredDays.length) *
          1000,
      ) / 10;

    const rmse =
      Math.round(
        Math.sqrt(
          run.days.reduce(
            (total, d) => total + (d.actual - d.predicted) ** 2,
            0,
          ) / run.days.length,
        ) * 10,
      ) / 10;

    accuracy.push({
      runId,
      productId: run.productId,
      productName: run.productName,
      model: run.model,
      horizonDays: run.horizonDays,
      mape,
      rmse,
      bias,
      status: accuracyStatus(mape),
    });
  }

  return accuracy;
}
