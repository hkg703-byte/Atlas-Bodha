import { readFile } from "node:fs/promises";

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

type CodexAuth = {
tokens?: {
access_token?: unknown;
account_id?: unknown;
};
};

async function readCredentials(): Promise<{ accessToken: string; accountId: string }> {
let auth: CodexAuth;
try {
auth = JSON.parse(await readFile(env.codexAuthFile, "utf8")) as CodexAuth;
} catch {
throw new Error("Codex subscription credentials are unavailable.");
}

const accessToken = auth.tokens?.access_token;
const accountId = auth.tokens?.account_id;
if (typeof accessToken !== "string" || typeof accountId !== "string") {
throw new Error("Codex subscription credentials are incomplete.");
}
return { accessToken, accountId };
}

export class CodexSubscriptionProvider implements AiProvider {
async streamResponse(input: GenerateResponseInput): Promise<AsyncIterable<string>> {
const credentials = await readCredentials();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 85_000);
const signal = input.signal
? AbortSignal.any([input.signal, controller.signal])
: controller.signal;
let response: Response;
try {
response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
method: "POST",
headers: {
Authorization: `Bearer ${credentials.accessToken}`,
"chatgpt-account-id": credentials.accountId,
"Content-Type": "application/json",
originator: "codex_cli_rs",
"OpenAI-Beta": "responses=experimental",
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
for await (const delta of await this.streamResponse(input)) {
text += delta;
}
return { text };
}
}
