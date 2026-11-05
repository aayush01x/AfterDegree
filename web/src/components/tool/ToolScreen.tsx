"use client";

import type { FeatureModule } from "@/features/types";
import { ToolLayout } from "./ToolLayout";

/** Route-level wrapper: plugs a feature module's config and View into ToolLayout. */
export function ToolScreen({ slug, feature }: { slug: string; feature: FeatureModule }) {
  const { config, View } = feature;
  const toParams = feature.toParams ?? feature.toBody ?? (config as { toParams?: FeatureModule["toParams"] } | undefined)?.toParams;
  return (
    <ToolLayout
      tool={slug}
      fields={config?.fields}
      defaults={config?.defaults}
      runLabel={config?.runLabel}
      autoRun={config?.autoRun}
      toParams={toParams}
      resultView={View ? (result) => <View result={result} /> : undefined}
    />
  );
}
