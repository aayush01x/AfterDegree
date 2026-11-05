"use client";

import type { FeatureModule } from "@/features/types";
import { ToolLayout } from "./ToolLayout";

/** Route-level wrapper: plugs a feature module's config and View into ToolLayout. */
export function ToolScreen({ slug, feature }: { slug: string; feature: FeatureModule }) {
  const { config, View } = feature;
  return (
    <ToolLayout
      tool={slug}
      fields={config?.fields}
      defaults={config?.defaults}
      runLabel={config?.runLabel}
      autoRun={config?.autoRun}
      resultView={View ? (result) => <View result={result} /> : undefined}
    />
  );
}
