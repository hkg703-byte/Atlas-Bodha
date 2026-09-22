import { env } from "@/lib/env";
import type { AiProvider } from "@/server/ai/providers/aiProvider";
import { CodexSubscriptionProvider } from "@/server/ai/providers/codexSubscriptionProvider";
import { OpenAiProvider } from "@/server/ai/providers/openAiProvider";

export function getAiProvider(): AiProvider {
if (env.aiProvider === "openai") return new OpenAiProvider();
if (env.aiProvider === "codex-subscription") {
return new CodexSubscriptionProvider();
}
throw new Error(`Unsupported AI_PROVIDER: ${env.aiProvider}`);
}
