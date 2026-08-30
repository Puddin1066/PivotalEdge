import { buildKgMetricsDashboard } from "@pivotaledge/workflows";

import { KgMetricsView } from "../../components/kg-metrics-view";

export const dynamic = "force-dynamic";

export default async function OpsKgPage() {
  const dashboard = await buildKgMetricsDashboard();
  return <KgMetricsView initial={dashboard} />;
}
