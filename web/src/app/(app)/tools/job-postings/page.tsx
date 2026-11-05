import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "Job posting analysis" };

export default function Page() {
  return <ToolRoute />;
}
