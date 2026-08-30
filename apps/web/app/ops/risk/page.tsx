import { buildOpsDashboard } from "@pivotaledge/workflows";

import { OpsRiskView } from "../../components/ops-risk-view";

export const dynamic = "force-dynamic";

export default async function OpsRiskPage() {
  const dash = await buildOpsDashboard();
  return <OpsRiskView initial={dash.risk} />;
}
