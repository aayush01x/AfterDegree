import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "Reverse career GPS" };

export default function Page() {
  return <ToolRoute />;
}
