import type { ComponentType } from "react";
import type { ToolField } from "@/lib/tools";
import type { Goals, ResultEnvelope } from "@/lib/types";

/** Context given to a feature's mockResult function in mock mode. */
export interface MockContext {
  params: Record<string, unknown>;
  goals: Goals;
  university: boolean;
}

export interface FeatureConfig {
  /** Form fields (dotted names map to nested body keys, e.g. "scope.school"). Defaults to lib/tools.ts. */
  fields?: ToolField[];
  /** Static default values by field name; URL query and stored goals win over these. */
  defaults?: Record<string, string>;
  /** Override the run button label. */
  runLabel?: string;
  /** Run immediately on arrival when required fields are already filled. Default true. */
  autoRun?: boolean;
}

export interface FeatureViewProps {
  result: ResultEnvelope;
}

/**
 * What web/src/features/<slug>/index.ts may export. Every export is optional:
 * a missing one falls back to the generic behaviour.
 */
export interface FeatureModule {
  config?: FeatureConfig;
  /** Contract-valid Result for mock mode: a fixed envelope or a function of the run. */
  mockResult?: ResultEnvelope | ((ctx: MockContext) => ResultEnvelope);
  /** Narrow-request variant in mock mode (thin cohort). Served when the request is narrow (exp_band max < 1) or the page URL has `?thin=1`. */
  mockResultThin?: ResultEnvelope | ((ctx: MockContext) => ResultEnvelope);
  /** Tool-specific result view; falls back to <ResultView result={…} />. */
  View?: ComponentType<FeatureViewProps>;
  /**
   * Convert the flat string form values (dotted names stay flat, e.g. "scope.school") to the
   * contract request body, e.g. people-like-me turns exp_band "1,3" into [1, 3].
   * ToolScreen uses it before sending the request.
   */
  toParams?(values: Record<string, string>): object;
  /** Alias of toParams for features that name it toBody. */
  toBody?(values: Record<string, string>): object;
}
