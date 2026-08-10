/**
 * STATIC REGISTRY — Topic × Dimension axes only.
 * NOT post ideas. NOT concrete seed subjects.
 * ORDER 2: separated from Seed Engine logic.
 */
export type TopicDimension = {
  cluster: string;
  dimension: string;
  core?: boolean;
};

/** Exploration axes for expand guidance — never a production seed body list */
export const DIMENSION_REGISTRY: TopicDimension[] = [
  { cluster: "FSD", dimension: "PEDESTRIAN_INTERACTION", core: true },
  { cluster: "FSD", dimension: "SUPERVISION", core: true },
  { cluster: "FSD", dimension: "MERGE_BEHAVIOR", core: true },
  { cluster: "FSD", dimension: "CONSTRUCTION", core: true },
  { cluster: "FSD", dimension: "SAFETY", core: true },
  { cluster: "FSD", dimension: "VERSION_CHANGE", core: true },
  { cluster: "FSD", dimension: "ROAD_CONTEXT", core: true },
  { cluster: "FSD", dimension: "EDGE_CASE", core: true },
  { cluster: "CYBERTRUCK", dimension: "DAILY_OWNERSHIP", core: true },
  { cluster: "CYBERTRUCK", dimension: "CHARGING", core: true },
  { cluster: "CYBERTRUCK", dimension: "ROAD_TRIP", core: true },
  { cluster: "CYBERTRUCK", dimension: "PARKING", core: true },
  { cluster: "CYBERTRUCK", dimension: "UTILITY", core: true },
  { cluster: "CYBERTRUCK", dimension: "WEATHER", core: true },
  { cluster: "CYBERTRUCK", dimension: "OWNER_TRADEOFF", core: true },
  { cluster: "ROBOTAXI", dimension: "CURBSIDE_OPS", core: true },
  { cluster: "ROBOTAXI", dimension: "FLEET_UTILIZATION", core: true },
  { cluster: "ROBOTAXI", dimension: "WAIT_TRUST", core: true },
  { cluster: "ROBOTAXI", dimension: "INFRASTRUCTURE", core: true },
  { cluster: "ROBOTAXI", dimension: "AIRPORT", core: true },
  { cluster: "ROBOTAXI", dimension: "EVENT_CONGESTION", core: true },
  { cluster: "ROBOTAXI", dimension: "USER_BEHAVIOR", core: true },
  { cluster: "AI_TECH", dimension: "TOOL_LIMITS" },
  { cluster: "AI_TECH", dimension: "SUMMARY_FAILURE" },
  { cluster: "AI_TECH", dimension: "TONE_EDIT" },
  { cluster: "AI_TECH", dimension: "EXPLAIN_DEPTH" },
  { cluster: "MUSK_DISCOURSE", dimension: "PRODUCT_AXIS" },
  { cluster: "MUSK_DISCOURSE", dimension: "ROADMAP_SIGNAL" },
  { cluster: "GAMING", dimension: "SHORT_SESSION" },
  { cluster: "GAMING", dimension: "INPUT_HARDWARE" },
];

export const CORE_CLUSTERS = new Set(["FSD", "CYBERTRUCK", "ROBOTAXI"]);
