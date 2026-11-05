import type { FeatureModule } from "./types";
import * as peopleLikeMe from "./people-like-me";
import * as internshipChances from "./internship-chances";
import * as conversionMap from "./conversion-map";
import * as reverseGps from "./reverse-gps";
import * as routesToPosition from "./routes-to-position";
import * as jobPostings from "./job-postings";
import * as indianFriendly from "./indian-friendly";
import * as marketSaturation from "./market-saturation";

/** Feature modules by tool slug. Used by mock mode to prefer a feature's own mockResult. */
export const FEATURES: Record<string, FeatureModule> = {
  "people-like-me": peopleLikeMe as FeatureModule,
  "internship-chances": internshipChances as FeatureModule,
  "conversion-map": conversionMap as FeatureModule,
  "reverse-gps": reverseGps as FeatureModule,
  "routes-to-position": routesToPosition as FeatureModule,
  "job-postings": jobPostings as FeatureModule,
  "indian-friendly": indianFriendly as FeatureModule,
  "market-saturation": marketSaturation as FeatureModule,
};
