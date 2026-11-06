"use client";

import { Suspense } from "react";
import * as internshipChances from "@/features/internship-chances";
import * as conversionMap from "@/features/conversion-map";
import type { FeatureModule } from "@/features/types";
import { MergedToolPage } from "@/components/tool/MergedToolPage";
import { mergedBySlug } from "@/lib/pages";

const FEATURES = {
  internship_chances: internshipChances as FeatureModule,
  conversion_map: conversionMap as FeatureModule,
};

export function InternshipToJobRoute() {
  return (
    <Suspense>
      <MergedToolPage page={mergedBySlug("internship-to-job")!} features={FEATURES} />
    </Suspense>
  );
}
