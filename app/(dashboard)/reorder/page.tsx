import { Package, ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getReorderRecommendations } from "@/features/intelligence/queries";
import type { ReorderUrgency } from "@/features/intelligence/types";
import { formatNumber } from "@/lib/format";

const urgencyRank: Record<ReorderUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const urgencyStyles: Record<
  ReorderUrgency,
  { label: string; tone: "red" | "amber" | "blue" | "neutral"; border: string }
> = {
  critical: { label: "Critical", tone: "red", border: "border-red-300" },
  high: { label: "High", tone: "amber", border: "border-amber-300" },
  medium: { label: "Medium", tone: "blue", border: "border-blue-300" },
  low: { label: "Low", tone: "neutral", border: "border-slate-200" },
};

export default async function ReorderPage() {
  const recommendations = await getReorderRecommendations();

  // Critical first, then high, medium, low; largest suggested quantity breaks ties.
  const sorted = [...recommendations].sort(
    (a, b) =>
      urgencyRank[a.urgency] - urgencyRank[b.urgency] ||
      b.suggestedQuantity - a.suggestedQuantity,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reorder Recommendations"
        description="Products to restock, ranked by urgency from forecasted demand, safety stock, and incoming purchase orders."
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No reorder recommendations"
          description="Every product is stocked above its reorder point. Recommendations appear here when predicted demand outpaces available and incoming stock."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((rec) => {
            const urgency = urgencyStyles[rec.urgency];
            return (
              <Card
                key={rec.productId}
                className={`flex flex-col ${urgency.border}`}
              >
                <CardHeader className="justify-between">
                  <div>
                    <CardTitle>{rec.productName}</CardTitle>
                    <CardDescription>SKU {rec.sku}</CardDescription>
                  </div>
                  <Badge tone={urgency.tone}>{urgency.label}</Badge>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <dl className="grid grid-cols-3 gap-4">
                    <div>
                      <dt className="text-xs text-slate-500">Current stock</dt>
                      <dd className="mt-1 text-lg font-semibold text-slate-900">
                        {formatNumber(rec.currentStock)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Predicted demand
                      </dt>
                      <dd className="mt-1 text-lg font-semibold text-slate-900">
                        {formatNumber(rec.predictedDemand)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Suggested qty</dt>
                      <dd className="mt-1 text-lg font-semibold text-blue-600">
                        {formatNumber(rec.suggestedQuantity)}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-sm text-slate-600">{rec.reason}</p>
                </CardContent>
                <CardFooter>
                  <ButtonLink
                    href={`/purchases/new?product=${rec.productId}&quantity=${rec.suggestedQuantity}`}
                    size="sm"
                    className="w-full"
                  >
                    <ShoppingCart className="size-4" />
                    Create Purchase Order
                  </ButtonLink>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
