"use client";

import * as feature from "@/features/conversion-map";
import type { FeatureModule } from "@/features/types";
import { ToolScreen } from "@/components/tool/ToolScreen";

/** Renders the shared tool frame with whatever the feature module exports (config, View). */
export function ToolRoute() {
  return <ToolScreen slug="conversion-map" feature={feature as FeatureModule} />;
}
