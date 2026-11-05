import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreView } from "@/components/drill/ExploreView";

export const metadata: Metadata = { title: "Explore" };

/** /explore?d=<base64url drill token>: one drill-down level (CONTRACT Appendix C/D). */
export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreView />
    </Suspense>
  );
}
