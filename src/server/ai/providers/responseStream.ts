import { ProviderRestingError } from "@/server/ai/providers/providerErrors";

function isRestingResponse(status: number, body: string): boolean {
return (
status === 401 ||
status === 429 ||
/usage[_ -]?limit|rate[_ -]?limit|quota/i.test(body)
);
}

export async function ensureProviderResponse(response: Response): Promise<Response> {
if (response.ok) {
return response;
}

const body = await response.text();
if (isRestingResponse(response.status, body)) {
throw new ProviderRestingError();
}
throw new Error(`AI provider request failed with status ${response.status}.`);
}

export async function* readResponsesApiText(
response: Response,
): AsyncGenerator<string> {
if (!response.body) {
throw new Error("AI provider returned no response body.");
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let completed = false;

try {
while (true) {
const { done, value } = await reader.read();
buffer += decoder.decode(value, { stream: !done });
const lines = buffer.split(/\r?\n/);
buffer = done ? "" : (lines.pop() ?? "");

for (const line of lines) {
if (!line.startsWith("data:")) continue;
const payload = line.slice(5).trim();
if (!payload || payload === "[DONE]") continue;

let event: unknown;
try {
event = JSON.parse(payload);
} catch {
throw new Error("AI provider returned malformed stream data.");
}

if (!event || typeof event !== "object") continue;
const typedEvent = event as { type?: unknown; delta?: unknown; error?: unknown };
if (
typedEvent.type === "response.output_text.delta" &&
typeof typedEvent.delta === "string"
) {
yield typedEvent.delta;
} else if (typedEvent.type === "response.completed") {
completed = true;
return;
} else if (typedEvent.type === "error" || typedEvent.type === "response.failed") {
const serialized = JSON.stringify(typedEvent.error ?? "provider error");
if (/usage[_ -]?limit|rate[_ -]?limit|quota|unauthorized/i.test(serialized)) {
throw new ProviderRestingError();
}
throw new Error("AI provider stream failed.");
}
}

if (done) break;
}
} finally {
await reader.cancel().catch(() => undefined);
}

if (!completed) {
throw new Error("AI provider stream ended before completion.");
}
}
