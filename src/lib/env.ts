function requireEnvironmentVariable(name: string): string {
const value = process.env[name];
if (!value) {
throw new Error(`Missing required environment variable: ${name}`);
}
return value;
}
export const env = {
get databaseUrl(): string {
return requireEnvironmentVariable("DATABASE_URL");
},
aiProvider: process.env.AI_PROVIDER ?? "codex-subscription",
aiModel: process.env.AI_MODEL ?? "gpt-6-luna",
codexAuthFile:
process.env.CODEX_AUTH_FILE ??
"/run/codex/auth.json",
openAiApiKey: process.env.OPENAI_API_KEY,
atlasDailyReplyLimit: Number(process.env.ATLAS_DAILY_REPLY_LIMIT ?? "60"),
};
