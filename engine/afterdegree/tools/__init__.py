"""The eight AfterDegree capabilities. Each is `async def run(ctx) -> Result`."""

from __future__ import annotations

from . import (
    college_paths,
    conversion_map,
    indian_friendly,
    internship_chances,
    job_postings,
    market_saturation,
    people_like_me,
    reverse_gps,
    routes_to_position,
)
from ..schemas import (
    CollegePathsBody,
    ConversionMapBody,
    IndianFriendlyBody,
    InternshipChancesBody,
    JobPostingsBody,
    MarketSaturationBody,
    PeopleLikeMeBody,
    ReverseGpsBody,
    RoutesToPositionBody,
)

TOOLS = {
    "people_like_me": (people_like_me.run, PeopleLikeMeBody, "people-like-me"),
    "internship_chances": (internship_chances.run, InternshipChancesBody, "internship-chances"),
    "conversion_map": (conversion_map.run, ConversionMapBody, "conversion-map"),
    "reverse_gps": (reverse_gps.run, ReverseGpsBody, "reverse-gps"),
    "routes_to_position": (routes_to_position.run, RoutesToPositionBody, "routes-to-position"),
    "job_postings": (job_postings.run, JobPostingsBody, "job-postings"),
    "indian_friendly": (indian_friendly.run, IndianFriendlyBody, "indian-friendly"),
    "market_saturation": (market_saturation.run, MarketSaturationBody, "market-saturation"),
    "college_paths": (college_paths.run, CollegePathsBody, "college-paths"),
}
