import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "People like me" };

export default function Page() {
  return <ToolRoute />;
}
