import type { ReactNode } from "react";
import { HubBootstrapProvider } from "./hub/_components/HubBootstrapProvider";

export default function HubLayout({ children }: { children: ReactNode }) {
  return <HubBootstrapProvider>{children}</HubBootstrapProvider>;
}
