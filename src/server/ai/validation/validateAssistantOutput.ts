const MAX_ASSISTANT_MESSAGE_LENGTH = 40_000;

export type AssistantOutputValidationResult =
| { valid: true; content: string }
| { valid: false; error: string };

export function validateAssistantOutput(
output: unknown,
): AssistantOutputValidationResult {
if (typeof output !== "string") {
return { valid: false, error: "Assistant output must be text." };
}
const content = output.trim();
if (!content) {
return { valid: false, error: "Assistant output was empty." };
}
if (content.length > MAX_ASSISTANT_MESSAGE_LENGTH) {
return {
valid: false,
error: "Assistant output exceeded the allowed length.",
};
}
return { valid: true, content };
}
