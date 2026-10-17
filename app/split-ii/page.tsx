import type { Metadata } from "next";
import SplitTwoRegistration from "./SplitTwoRegistration";

export const metadata: Metadata = {
  title: "Expat China League | Split II: Draft",
  description: "Register for ECL Split II: Draft. 30 places, random team draw and a 3,000 RMB first prize.",
  robots: { index: false, follow: false },
};

export default function SplitTwoPage() {
  return <SplitTwoRegistration />;
}
