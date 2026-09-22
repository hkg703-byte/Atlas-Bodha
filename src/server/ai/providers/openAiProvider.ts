import { env } from "@/lib/env";
import type {
AiProvider,
GenerateResponseInput,
GenerateResponseResult,
} from "@/server/ai/providers/aiProvider";
import {
ensureProviderResponse,
readResponsesApiText,
} from "@/server/ai/providers/responseStream";

export class OpenAiProvider implements AiProvider {
async streamResponse(input: GenerateResponseInput): Promise<AsyncIterable<string>> {
if (!env.openAiApiKey) {
throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 85_000);
const signal = input.signal
? AbortSignal.any([input.signal, controller.signal])
: controller.signal;
let response: Response;
try {
response = await fetch("https://api.openai.com/v1/responses", {
method: "POST",
headers: {
Authorization: `Bearer ${env.openAiApiKey}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
model: env.aiModel,
instructions: input.systemInstruction,
input: input.messages.map((message) => ({
role: message.role,
content: [
{
type: message.role === "assistant" ? "output_text" : "input_text",
text: message.content,
},
],
})),
stream: true,
store: false,
reasoning: { effort: "low" },
}),
signal,
});
} catch (error) {
clearTimeout(timeout);
throw error;
}

let checkedResponse: Response;
try {
checkedResponse = await ensureProviderResponse(response);
} catch (error) {
clearTimeout(timeout);
throw error;
}
return (async function* () {
try {
yield* readResponsesApiText(checkedResponse);
} finally {
clearTimeout(timeout);
}
})();
}

async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseResult> {
let text = "";
for await (const delta of await this.streamResponse(input)) text += delta;
return { text };
}
}
