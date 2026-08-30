import { buildOpsDashboard } from "@pivotaledge/workflows";

import { OpsChrome } from "../components/ops-chrome";

export const dynamic = "force-dynamic";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const dashboard = await buildOpsDashboard();
  return <OpsChrome initial={dashboard}>{children}</OpsChrome>;
}
