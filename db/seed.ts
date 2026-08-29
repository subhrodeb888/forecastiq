import "dotenv/config";
import { db } from "./index";
import * as schema from "./schema";
import { sql } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";

/* ─── Helpers ─── */

function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateBetween(start: Date, end: Date) {
  const min = start.getTime();
  const max = end.getTime();
  return new Date(min + Math.random() * (max - min));
}

/* ─── Clear tables (reverse FK order) ─── */

async function clear() {
  console.log("🧹 Clearing existing data…");
  await db.delete(schema.forecasts);
  await db.delete(schema.forecastRuns);
  await db.delete(schema.stockMovements);
  await db.delete(schema.saleItems);
  await db.delete(schema.sales);
  await db.delete(schema.purchaseItems);
  await db.delete(schema.purchases);
  await db.delete(schema.batches);
  await db.delete(schema.products);
  await db.delete(schema.suppliers);
  await db.delete(schema.categories);
  // Keep the demo user so demo login still works after re-seed.
  // Only delete it if we also delete real users — but since there is no
  // separate user-ownership layer this is safe.
  await db.delete(schema.accounts);
  await db.delete(schema.users);
  console.log("✅ Cleared");
}

/* ─── Seed ─── */

async function seed() {
  await clear();

  /* ── Demo user ── */
  await db.insert(schema.users).values({
    id: "demo-user-fiq",
    name: "Demo User",
    email: "demo@forecastiq.app",
  });
  console.log("👤 Demo user created");

  /* ── Categories ── */
  const cats = await db
    .insert(schema.categories)
    .values([
      {
        id: uuid(),
        name: "Pain Relief",
        description: "Analgesics & antipyretics",
      },
      {
        id: uuid(),
        name: "Vitamins & Supplements",
        description: "Nutritional supplements",
      },
      {
        id: uuid(),
        name: "Antibiotics",
        description: "Antibacterial medicines",
      },
      {
        id: uuid(),
        name: "Chronic Care",
        description: "Diabetes, BP, thyroid",
      },
      {
        id: uuid(),
        name: "First Aid",
        description: "Wound care & antiseptics",
      },
    ])
    .returning();
  console.log(`📦 ${cats.length} categories`);

  /* ── Suppliers ── */
  const sups = await db
    .insert(schema.suppliers)
    .values([
      {
        id: uuid(),
        name: "Apollo Pharmacy Distributors",
        contactPerson: "Ramesh Iyer",
        email: "ramesh@apollo-dist.com",
        phone: "+91-44-12345678",
        address: "Chennai, TN",
      },
      {
        id: uuid(),
        name: "MedLife Wholesale",
        contactPerson: "Priya Sharma",
        email: "priya@medlife.com",
        phone: "+91-80-87654321",
        address: "Bangalore, KA",
      },
      {
        id: uuid(),
        name: "NetMeds Supply Co",
        contactPerson: "Arun Kumar",
        email: "arun@netmeds.co",
        phone: "+91-11-55556666",
        address: "Delhi, NCR",
      },
      {
        id: uuid(),
        name: "Local Pharma Hub",
        contactPerson: "Suresh Patel",
        email: "suresh@localpharma.in",
        phone: "+91-79-44443333",
        address: "Ahmedabad, GJ",
      },
    ])
    .returning();
  console.log(`🏭 ${sups.length} suppliers`);

  /* ── Products ── */
  const productData = [
    {
      name: "Paracetamol 500mg",
      sku: "PCM-500",
      manufacturer: "Cipla",
      cat: "Pain Relief",
      price: "25.00",
      stock: 240,
      reorder: 100,
      safety: 60,
    },
    {
      name: "Ibuprofen 400mg",
      sku: "IBU-400",
      manufacturer: "Abbott",
      cat: "Pain Relief",
      price: "35.00",
      stock: 180,
      reorder: 80,
      safety: 40,
    },
    {
      name: "Dolo 650mg",
      sku: "DLO-650",
      manufacturer: "Micro Labs",
      cat: "Pain Relief",
      price: "30.00",
      stock: 300,
      reorder: 120,
      safety: 60,
    },
    {
      name: "Crocin Advance",
      sku: "CRC-ADV",
      manufacturer: "GSK",
      cat: "Pain Relief",
      price: "28.00",
      stock: 150,
      reorder: 60,
      safety: 30,
    },
    {
      name: "Vitamin C 500mg",
      sku: "VIT-C5",
      manufacturer: "HealthVit",
      cat: "Vitamins & Supplements",
      price: "120.00",
      stock: 90,
      reorder: 50,
      safety: 25,
    },
    {
      name: "Zincovit",
      sku: "ZNC-VT",
      manufacturer: "Apex",
      cat: "Vitamins & Supplements",
      price: "95.00",
      stock: 70,
      reorder: 40,
      safety: 20,
    },
    {
      name: "B-Complex",
      sku: "B-COMP",
      manufacturer: "Pfizer",
      cat: "Vitamins & Supplements",
      price: "45.00",
      stock: 0,
      reorder: 30,
      safety: 15,
    },
    {
      name: "Calcium + D3",
      sku: "CAL-D3",
      manufacturer: "Shelcal",
      cat: "Vitamins & Supplements",
      price: "180.00",
      stock: 40,
      reorder: 25,
      safety: 10,
    },
    {
      name: "Amoxicillin 250mg",
      sku: "AMX-250",
      manufacturer: "Alkem",
      cat: "Antibiotics",
      price: "55.00",
      stock: 120,
      reorder: 50,
      safety: 20,
    },
    {
      name: "Azithromycin 500mg",
      sku: "AZM-500",
      manufacturer: "Sun Pharma",
      cat: "Antibiotics",
      price: "85.00",
      stock: 60,
      reorder: 30,
      safety: 15,
    },
    {
      name: "Metformin 500mg",
      sku: "MET-500",
      manufacturer: "USV",
      cat: "Chronic Care",
      price: "40.00",
      stock: 200,
      reorder: 100,
      safety: 50,
    },
    {
      name: "Omeprazole 20mg",
      sku: "OMP-20",
      manufacturer: "Dr Reddy's",
      cat: "Chronic Care",
      price: "38.00",
      stock: 160,
      reorder: 80,
      safety: 40,
    },
    {
      name: "Pantoprazole 40mg",
      sku: "PTZ-40",
      manufacturer: "Lupin",
      cat: "Chronic Care",
      price: "42.00",
      stock: 110,
      reorder: 50,
      safety: 25,
    },
    {
      name: "Aspirin 75mg",
      sku: "ASP-75",
      manufacturer: "Bayer",
      cat: "Chronic Care",
      price: "15.00",
      stock: 300,
      reorder: 150,
      safety: 75,
    },
    {
      name: "Cetirizine 10mg",
      sku: "CTZ-10",
      manufacturer: "Cipla",
      cat: "Pain Relief",
      price: "18.00",
      stock: 220,
      reorder: 100,
      safety: 50,
    },
    {
      name: "Levocetirizine 5mg",
      sku: "LCT-5",
      manufacturer: "Mankind",
      cat: "Pain Relief",
      price: "22.00",
      stock: 80,
      reorder: 40,
      safety: 20,
    },
    {
      name: "Disprin",
      sku: "DSP-IN",
      manufacturer: "Reckitt",
      cat: "Pain Relief",
      price: "12.00",
      stock: 400,
      reorder: 200,
      safety: 100,
    },
    {
      name: "Electral ORS",
      sku: "ELT-ORS",
      manufacturer: "FDC",
      cat: "First Aid",
      price: "22.00",
      stock: 500,
      reorder: 200,
      safety: 100,
    },
    {
      name: "Betadine Ointment",
      sku: "BTD-OIN",
      manufacturer: "Win-Medicare",
      cat: "First Aid",
      price: "65.00",
      stock: 30,
      reorder: 20,
      safety: 10,
    },
    {
      name: "Insulin Glargine",
      sku: "INS-GL",
      manufacturer: "Sanofi",
      cat: "Chronic Care",
      price: "450.00",
      stock: 8,
      reorder: 15,
      safety: 10,
    },
  ];

  const catMap = new Map(cats.map((c) => [c.name, c.id]));

  const prods = await db
    .insert(schema.products)
    .values(
      productData.map((p) => ({
        id: uuid(),
        name: p.name,
        sku: p.sku,
        manufacturer: p.manufacturer,
        categoryId: catMap.get(p.cat)!,
        sellingPrice: p.price,
        currentStock: 0, // updated after batches
        reorderLevel: p.reorder,
        safetyStock: p.safety,
      })),
    )
    .returning();
  console.log(`💊 ${prods.length} products`);

  /* ── Batches ── */
  const batchInputs: (typeof schema.batches.$inferInsert)[] = [];
  const batchMeta: {
    productId: string;
    qty: number;
    price: string;
    expiry: Date;
  }[] = [];

  for (const p of prods) {
    const base = productData.find((d) => d.sku === p.sku)!;
    const batchCount = base.stock === 0 ? 0 : randInt(1, 3);

    for (let i = 0; i < batchCount; i++) {
      const qty =
        i === batchCount - 1
          ? base.stock -
            batchMeta
              .filter((b) => b.productId === p.id)
              .reduce((s, b) => s + b.qty, 0)
          : Math.floor(base.stock / batchCount) + randInt(-5, 5);

      const expiry = daysFromNow(randInt(-10, 365)); // some expired, some far out
      const pprice = (
        parseFloat(base.price) *
        (0.4 + Math.random() * 0.3)
      ).toFixed(2);

      batchInputs.push({
        id: uuid(),
        productId: p.id,
        batchNumber: `${p.sku}-B${i + 1}`,
        quantity: Math.max(qty, 1),
        purchasePrice: pprice,
        expiryDate: expiry,
      });
      batchMeta.push({
        productId: p.id,
        qty: Math.max(qty, 1),
        price: pprice,
        expiry,
      });
    }
  }

  const batchRows = await db
    .insert(schema.batches)
    .values(batchInputs)
    .returning();
  console.log(`📦 ${batchRows.length} batches`);

  // Update product.currentStock to match batch totals
  for (const p of prods) {
    const total = batchMeta
      .filter((b) => b.productId === p.id)
      .reduce((s, b) => s + b.qty, 0);
    await db
      .update(schema.products)
      .set({ currentStock: total })
      .where(eq(schema.products.id, p.id));
  }

  /* ── Purchases ── */
  const purchaseStatuses = [
    "draft",
    "ordered",
    "partially_received",
    "received",
    "cancelled",
  ] as const;
  const poInputs: (typeof schema.purchases.$inferInsert)[] = [];
  const poItems: (typeof schema.purchaseItems.$inferInsert)[] = [];
  const poMovements: (typeof schema.stockMovements.$inferInsert)[] = [];

  for (let i = 0; i < 12; i++) {
    const status = purchaseStatuses[i % purchaseStatuses.length];
    const supplier = randItem(sups);
    const date = daysAgo(randInt(1, 60));
    const total = randInt(2000, 15000).toFixed(2);

    const poId = uuid();
    poInputs.push({
      id: poId,
      supplierId: supplier.id,
      status,
      purchaseDate: date,
      deliveryDate:
        status === "draft" ? undefined : daysFromNow(randInt(1, 14)),
      totalAmount: total,
      notes: i === 0 ? "Urgent restock" : undefined,
    });

    // 1-3 items per PO
    const itemCount = randInt(1, 3);
    for (let j = 0; j < itemCount; j++) {
      const product = randItem(prods);
      const qty = randInt(50, 200);
      const price = (
        parseFloat(product.sellingPrice) *
        (0.4 + Math.random() * 0.3)
      ).toFixed(2);
      poItems.push({
        id: uuid(),
        purchaseId: poId,
        productId: product.id,
        quantity: qty,
        purchasePrice: price,
      });
    }

    // If received or partially_received, add stock_movements
    if (status === "received" || status === "partially_received") {
      const receivedQty =
        status === "received"
          ? poItems[poItems.length - 1].quantity
          : Math.floor(poItems[poItems.length - 1].quantity / 2);
      poMovements.push({
        id: uuid(),
        productId: poItems[poItems.length - 1].productId,
        type: "purchase",
        quantity: receivedQty,
        referenceId: poId,
        notes: "Purchase receipt",
      });
    }
  }

  const pos = await db.insert(schema.purchases).values(poInputs).returning();
  await db.insert(schema.purchaseItems).values(poItems);
  if (poMovements.length)
    await db.insert(schema.stockMovements).values(poMovements);
  console.log(`📋 ${pos.length} purchase orders`);

  /* ── Sales ── */
  const saleInputs: (typeof schema.sales.$inferInsert)[] = [];
  const saleItemInputs: (typeof schema.saleItems.$inferInsert)[] = [];
  const saleMovementInputs: (typeof schema.stockMovements.$inferInsert)[] = [];

  // Weighted product selection: popular items sell more
  const weights = prods.map((p) => {
    if (
      [
        "PCM-500",
        "DLO-650",
        "CRC-ADV",
        "MET-500",
        "ASP-75",
        "ELT-ORS",
      ].includes(p.sku)
    )
      return 5;
    if (["IBU-400", "VIT-C5", "CTZ-10", "OMP-20", "DSP-IN"].includes(p.sku))
      return 3;
    return 1;
  });
  const weightTotal = weights.reduce((a, b) => a + b, 0);

  function weightedProduct() {
    let r = Math.random() * weightTotal;
    for (let i = 0; i < prods.length; i++) {
      r -= weights[i];
      if (r <= 0) return prods[i];
    }
    return prods[prods.length - 1];
  }

  for (let i = 0; i < 80; i++) {
    const product = weightedProduct();
    const qty = randInt(1, 5);
    const date = randomDateBetween(daysAgo(90), daysAgo(0));
    const total = (qty * parseFloat(product.sellingPrice)).toFixed(2);

    const saleId = uuid();
    saleInputs.push({
      id: saleId,
      saleDate: date,
      totalAmount: total,
    });

    saleItemInputs.push({
      id: uuid(),
      saleId,
      productId: product.id,
      quantity: qty,
      sellingPrice: product.sellingPrice,
    });

    saleMovementInputs.push({
      id: uuid(),
      productId: product.id,
      type: "sale",
      quantity: -qty,
      referenceId: saleId,
      notes: "Sale transaction",
    });
  }

  const salesRows = await db
    .insert(schema.sales)
    .values(saleInputs)
    .returning();
  await db.insert(schema.saleItems).values(saleItemInputs);
  await db.insert(schema.stockMovements).values(saleMovementInputs);
  console.log(`🛒 ${salesRows.length} sales`);

  // Recalculate product stock after sales
  for (const p of prods) {
    const batchTotal = batchMeta
      .filter((b) => b.productId === p.id)
      .reduce((s, b) => s + b.qty, 0);
    const sold = saleMovementInputs
      .filter((m) => m.productId === p.id)
      .reduce((s, m) => s + Math.abs(m.quantity), 0);
    const purchased = poMovements
      .filter((m) => m.productId === p.id)
      .reduce((s, m) => s + m.quantity, 0);
    const newStock = Math.max(0, batchTotal - sold + purchased);
    await db
      .update(schema.products)
      .set({ currentStock: newStock })
      .where(eq(schema.products.id, p.id));
  }

  /* ── Forecasts ── */
  const forecastProducts = prods.filter((p) =>
    ["PCM-500", "DLO-650", "MET-500", "VIT-C5"].includes(p.sku),
  );
  for (const p of forecastProducts) {
    const runId = uuid();
    const model = randItem(["holt_winters", "linear_trend", "moving_average"]);
    const horizon = randItem([14, 30]);

    await db.insert(schema.forecastRuns).values({
      id: runId,
      productId: p.id,
      model,
      horizonDays: horizon,
      confidenceScore: (0.7 + Math.random() * 0.25).toFixed(2),
    });

    const forecastPoints = [];
    for (let d = 1; d <= horizon; d++) {
      const base = randInt(5, 25);
      forecastPoints.push({
        id: uuid(),
        productId: p.id,
        runId,
        forecastDate: daysFromNow(d),
        predictedDemand: base.toFixed(2),
        lowerBound: Math.max(0, base - randInt(2, 5)).toFixed(2),
        upperBound: (base + randInt(2, 5)).toFixed(2),
        confidenceScore: (0.7 + Math.random() * 0.25).toFixed(2),
      });
    }
    await db.insert(schema.forecasts).values(forecastPoints);
  }
  console.log(`🔮 ${forecastProducts.length} forecast runs`);

  /* ── One adjustment movement for variety ── */
  await db.insert(schema.stockMovements).values({
    id: uuid(),
    productId: prods[0].id,
    type: "adjustment",
    quantity: 10,
    notes: "Inventory audit correction",
  });

  console.log(
    "\n🎉 Seed complete! Run `npm run dev` and open http://localhost:3000/dashboard",
  );
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
