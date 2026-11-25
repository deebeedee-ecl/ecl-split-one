import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { HubAccessGate } from "@/app/(hub)/hub/_components/HubAccessGate";
import { HubBootstrapProvider } from "@/app/(hub)/hub/_components/HubBootstrapProvider";
import { isChinaStatsPreviewEnabled } from "@/lib/china-stats-preview-config";
import { ChinaStatsLabFrame } from "./ChinaStatsLabFrame";

export const metadata: Metadata = {
  title: "China Stats | ECL",
  description: "China-server rankings, player profiles, and ranked match history.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ChinaStatsLabLayout({ children }: { children: ReactNode }) {
  if (!isChinaStatsPreviewEnabled()) notFound();

  const content = <ChinaStatsLabFrame>{children}</ChinaStatsLabFrame>;

  return process.env.NODE_ENV === "development" ? content : (
    <HubBootstrapProvider>
      <HubAccessGate>{content}</HubAccessGate>
    </HubBootstrapProvider>
  );
}
