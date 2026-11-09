import { notFound } from "next/navigation";
import DashboardPreview from "../DashboardPreview";

export default function SplitTwoDesignPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DashboardPreview />;
}
