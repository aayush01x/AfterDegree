import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "Market saturation" };

export default function Page() {
  return <ToolRoute />;
}
