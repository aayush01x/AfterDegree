import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "Routes to a position" };

export default function Page() {
  return <ToolRoute />;
}
