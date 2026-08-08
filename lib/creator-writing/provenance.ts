/**
 * Creator writing dual-axis provenance
 * Initiative Origin ≠ AI Transformation
 */
export type InitiativeOrigin =
  | "CREATOR_INITIATED"
  | "PLANNER_SUGGESTED"
  | "UNKNOWN_EXTERNAL"
  | "UNKNOWN";

export type AiTransformation =
  | "NONE"
  | "POLISH"
  | "GENERATIVE_REWRITE"
  | "UNKNOWN";

export type LengthControl =
  | "KEEP"
  | "SHORT"
  | "MEDIUM"
  | "LONG"
  | "VERY_LONG"
  | "AUTO";

export type TransformMode = "POLISH" | "AI_WRITE";

export type CreatorWritingSession = {
  initiative_origin: InitiativeOrigin;
  ai_transformation: AiTransformation;
  creator_raw_input: string;
  current_text: string;
  length_control: LengthControl;
  pipeline_id: string;
};

export function defaultCreatorSession(
  pipelineId = "42303"
): CreatorWritingSession {
  return {
    initiative_origin: "CREATOR_INITIATED",
    ai_transformation: "NONE",
    creator_raw_input: "",
    current_text: "",
    length_control: "AUTO",
    pipeline_id: pipelineId,
  };
}
