import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "Indian-friendly employers" };

export default function Page() {
  return <ToolRoute />;
}
