import type { Metadata } from "next";
import { ToolRoute } from "./tool-route";

export const metadata: Metadata = { title: "Internship-to-job chances" };

export default function Page() {
  return <ToolRoute />;
}
