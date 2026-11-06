import type { Metadata } from "next";
import { CareerRoutesRoute } from "./route-client";

export const metadata: Metadata = { title: "Career routes" };

export default function Page() {
  return <CareerRoutesRoute />;
}
