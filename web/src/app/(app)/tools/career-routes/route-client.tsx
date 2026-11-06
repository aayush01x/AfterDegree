"use client";

import { Suspense } from "react";
import * as reverseGps from "@/features/reverse-gps";
import * as routesToPosition from "@/features/routes-to-position";
import * as collegePaths from "@/features/college-paths";
import type { FeatureModule } from "@/features/types";
import { MergedToolPage } from "@/components/tool/MergedToolPage";
import { mergedBySlug } from "@/lib/pages";

const FEATURES = {
  reverse_gps: reverseGps as FeatureModule,
  routes_to_position: routesToPosition as FeatureModule,
  college_paths: collegePaths as FeatureModule,
};

export function CareerRoutesRoute() {
  return (
    <Suspense>
      <MergedToolPage page={mergedBySlug("career-routes")!} features={FEATURES} />
    </Suspense>
  );
}
