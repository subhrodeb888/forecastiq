export type ReorderUrgency = "critical" | "high" | "medium" | "low";

export interface ReorderRecommendation {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  incomingStock: number;
  predictedDemand: number;
  safetyStock: number;
  reorderLevel: number;
  suggestedQuantity: number;
  reason: string;
  urgency: ReorderUrgency;
}