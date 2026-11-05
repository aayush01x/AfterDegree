import type { Metadata } from "next";
import { Suspense } from "react";
import { PersonView } from "@/components/drill/PersonView";

export const metadata: Metadata = { title: "Career path" };

/** /people/<id>?from=<drill token>: one anonymous career path. */
export default function PersonPage() {
  return (
    <Suspense>
      <PersonView />
    </Suspense>
  );
}
