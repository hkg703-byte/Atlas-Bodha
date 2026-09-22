export type AiConversationMessage = {
role: "user" | "assistant";
content: string;
};

export type GenerateResponseInput = {
systemInstruction: string;
messages: AiConversationMessage[];
signal?: AbortSignal;
  /** low | medium | high. Replies use AI_REASONING_EFFORT (default medium); quick checks stay low. */
  reasoningEffort?: "low" | "medium" | "high";
};

export type GenerateResponseResult = {
text: string;
};

export interface AiProvider {
generateResponse(input: GenerateResponseInput): Promise<GenerateResponseResult>;
streamResponse(input: GenerateResponseInput): Promise<AsyncIterable<string>>;
}
