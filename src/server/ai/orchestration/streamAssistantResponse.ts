import { buildConversationContext } from "@/server/ai/context/buildConversationContext";
import { getAiProvider } from "@/server/ai/providers/getAiProvider";
import { atlasSystemPromptForSafetyTier } from "@/server/ai/prompts/atlasSystemPrompt";
import {
classifySafetyTier,
type SafetyTier,
} from "@/server/ai/safety/classifySafetyTier";
import { validateAssistantOutput } from "@/server/ai/validation/validateAssistantOutput";

type StreamAssistantResponseInput = {
userId: string;
conversationId: string;
onSafety?: (tier: SafetyTier) => void | Promise<void>;
signal?: AbortSignal;
};

export type StreamedAssistantResponse = {
stream: AsyncIterable<string>;
safetyTier: SafetyTier;
};

async function* validateCompletedStream(
source: AsyncIterable<string>,
): AsyncGenerator<string> {
let completeText = "";
for await (const delta of source) {
completeText += delta;
yield delta;
}
const validation = validateAssistantOutput(completeText);
if (!validation.valid) throw new Error(validation.error);
}

export async function streamAssistantResponse({
userId,
conversationId,
onSafety,
signal,
}: StreamAssistantResponseInput): Promise<StreamedAssistantResponse> {
const messages = await buildConversationContext({ userId, conversationId });
if (!messages.length) {
throw new Error(
"Cannot generate an Assistant response without Conversation context.",
);
}

const provider = getAiProvider();
const safetyTier = await classifySafetyTier(provider, messages, signal);
signal?.throwIfAborted();
await onSafety?.(safetyTier);
const providerStream = await provider.streamResponse({
systemInstruction: atlasSystemPromptForSafetyTier(safetyTier),
messages,
signal,
});

return {
stream: validateCompletedStream(providerStream),
safetyTier,
};
}
