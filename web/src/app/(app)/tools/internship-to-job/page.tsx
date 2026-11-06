import type { Metadata } from "next";
import { InternshipToJobRoute } from "./route-client";

export const metadata: Metadata = { title: "Internship to job" };

export default function Page() {
  return <InternshipToJobRoute />;
}
