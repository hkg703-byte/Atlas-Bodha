import { streamAssistantResponse } from "@/server/ai/orchestration/streamAssistantResponse";
import type { SafetyTier } from "@/server/ai/safety/classifySafetyTier";
import { validateAssistantOutput } from "@/server/ai/validation/validateAssistantOutput";

type GenerateAssistantResponseInput = {
userId: string;
conversationId: string;
onSafety?: (tier: SafetyTier) => void | Promise<void>;
signal?: AbortSignal;
};

export type GeneratedAssistantResponse = {
content: string;
safetyTier: SafetyTier;
};

export async function generateAssistantResponse(
input: GenerateAssistantResponseInput,
): Promise<GeneratedAssistantResponse> {
const result = await streamAssistantResponse(input);
let text = "";
for await (const delta of result.stream) text += delta;
const validation = validateAssistantOutput(text);
if (!validation.valid) throw new Error(validation.error);
return { content: validation.content, safetyTier: result.safetyTier };
}
