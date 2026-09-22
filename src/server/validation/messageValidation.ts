const MAX_MESSAGE_LENGTH = 20_000;
export type MessageValidationResult =
| {
valid: true;
content: string;
}
| {
valid: false;
error: string;
};
export function validatePersonMessage(
input: unknown,
): MessageValidationResult {
if (typeof input !== "string") {
return {
valid: false,
error: "Message content must be text.",
};
}
const content = input.trim();
if (!content) {
return {
valid: false,
error: "Message content is required.",
};
}
if (content.length > MAX_MESSAGE_LENGTH) {
return {
valid: false,
error: `Message content must be ${MAX_MESSAGE_LENGTH.toLocaleString()}
characters or fewer.`,
};
}
return {
valid: true,
content,
};
}
