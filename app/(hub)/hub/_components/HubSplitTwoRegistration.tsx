"use client";

import SplitTwoRegistration from "@/app/(public)/split-ii/SplitTwoRegistration";
import { useHubBootstrap } from "./HubBootstrapProvider";

export function HubSplitTwoRegistration({ preview = false }: { preview?: boolean }) {
  const { status, accessToken, session } = useHubBootstrap();

  return (
    <SplitTwoRegistration
      inDashboard
      preview={preview}
      sharedAuth={{
        ready: status !== "loading",
        accessToken,
        userId: session?.user.id ?? null,
      }}
    />
  );
}
