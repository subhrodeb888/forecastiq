import { redirect } from "next/navigation";

/**
 * /insights lives on as an alias — the reorder recommendations page is
 * ForecastIQ's AI insights surface. Redirect (307) so old links keep working.
 */
export default function InsightsPage() {
  redirect("/reorder");
}
