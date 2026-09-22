export const SAFETY_RESOURCES = "If you'd like to talk to someone right now: call or text 988 (Suicide & Crisis Lifeline), or text HOME to 741741 (Crisis Text Line). In an emergency call 911.";
export type AtlasStreamEvent =
  | { type: "start" }
  | { type: "delta"; text: string }
  | { type: "safety"; tier: number; resources: string | null }
  | { type: "complete" }
  | { type: "error"; message: string };
export function encodeStreamEvent(event: AtlasStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}
