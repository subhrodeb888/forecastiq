# ForecastIQ Pharmacy — Project Context

## Tech Stack
- Next.js 16 App Router, React 19, TypeScript, Tailwind v4
- Drizzle ORM + Neon (HTTP client, Edge Runtime)
- NextAuth v5 + Google OAuth
- FastAPI ML service (port 8000)
- shadcn/ui-style design system (no shadcn installed)

## Design System
- Colors: slate-50/100/200/300/400/500/600/700/800/900 + blue-600 primary
- Cards: rounded-xl border bg-white shadow-sm
- Buttons: rounded-lg px-5 py-2.5, primary bg-blue-600 hover:bg-blue-700
- Tables: bg-slate-50 header, border-t rows, hover:bg-slate-50
- Inputs: rounded-lg border-slate-300, focus:border-blue-500 focus:ring-2 focus:ring-blue-100
- Badges: rounded-full border, tone variants (blue/emerald/amber/red/violet)
- Icons: lucide-react
- Font: Geist Sans (already in layout)

## Schema Summary
- users, accounts (NextAuth)
- categories: id, name, description
- suppliers: id, name, contactPerson, email, phone, address
- products: id, name, sku, manufacturer, categoryId, sellingPrice, currentStock, reorderLevel, safetyStock
- batches: id, productId, batchNumber, quantity, purchasePrice, expiryDate
- purchases: id, supplierId, status(draft/ordered/partially_received/received/cancelled), purchaseDate, deliveryDate, totalAmount, notes
- purchase_items: id, purchaseId, productId, quantity, purchasePrice
- sales: id, saleDate, totalAmount, notes
- sale_items: id, saleId, productId, quantity, sellingPrice, batchId
- stock_movements: id, productId, batchId, type(sale/purchase/adjustment/damage/return/expiry), quantity, referenceId, notes, userId
- forecast_runs: id, productId, userId, model, horizonDays, confidenceScore
- forecasts: id, productId, runId, forecastDate, predictedDemand, lowerBound, upperBound

## Key Patterns
- Server Actions: "use server", auth() check first, Zod validation, revalidatePath
- Queries: Drizzle select/join/groupBy, return typed arrays
- Forms: useActionState for async, inline errors, loading states
- Components: Card, Badge, Button, Input, Label, Table, PageHeader in components/ui/
- Formatting: lib/format.ts (formatCurrency, formatNumber, formatDateUTC)

## Current State
- Dashboard, products, categories, forecast, reports pages exist
- Product CRUD works but lacks batch entry
- Forecast ML pipeline works (Holt-Winters, Linear, MA)
- Missing: batch UI, FEFO, expiry dashboard, purchase workflow, reorder engine

## File Structure
- app/(dashboard)/ — all protected routes
- features/inventory/ — batch queries, actions, FEFO logic
- features/purchases/ — purchase order queries, actions
- features/reports/ — existing reports (monthly sales, top products, low stock)
- features/forecast/ — existing forecast pipeline
- components/ui/ — shared primitives
- db/schema.ts — source of truth
- lib/ — validations, formatting, env

## ML Service
- FastAPI on :8000, endpoints: POST /forecasts (auto-select), POST /predict (trained RF)
- Models: moving_average, linear_trend, holt_winters
- Adding: croston.py for intermittent demand