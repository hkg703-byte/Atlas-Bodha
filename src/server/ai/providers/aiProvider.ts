export type AiConversationMessage = {
role: "user" | "assistant";
content: string;
};

export type AiReasoningEffort = "low" | "medium" | "high";

export function replyReasoningEffort(
value = process.env.AI_REASONING_EFFORT,
): AiReasoningEffort {
return value === "low" || value === "medium" || value === "high"
? value
: "medium";
}

export type GenerateResponseInput = {
systemInstruction: string;
messages: AiConversationMessage[];
signal?: AbortSignal;
  /** low | medium | high. Replies use AI_REASONING_EFFORT (default medium); quick checks stay low. */
  reasoningEffort?: AiReasoningEffort;
};

export type GenerateResponseResult = {
text: string;
};

export interface AiProvider {
generateResponse(input: GenerateResponseInput): Promise<GenerateResponseResult>;
streamResponse(input: GenerateResponseInput): Promise<AsyncIterable<string>>;
}
