export type AiConversationMessage = {
role: "user" | "assistant";
content: string;
};

export type GenerateResponseInput = {
systemInstruction: string;
messages: AiConversationMessage[];
signal?: AbortSignal;
};

export type GenerateResponseResult = {
text: string;
};

export interface AiProvider {
generateResponse(input: GenerateResponseInput): Promise<GenerateResponseResult>;
streamResponse(input: GenerateResponseInput): Promise<AsyncIterable<string>>;
}
