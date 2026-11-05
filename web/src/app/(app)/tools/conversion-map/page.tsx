import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "Conversion map" };

export default function Page() {
  return <ToolRoute />;
}
