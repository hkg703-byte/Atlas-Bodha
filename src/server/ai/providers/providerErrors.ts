export const ATLAS_RESTING_MESSAGE =
"Atlas is resting right now and will be back soon.";

export class ProviderRestingError extends Error {
constructor() {
super(ATLAS_RESTING_MESSAGE);
this.name = "ProviderRestingError";
}
}

export function isProviderRestingError(error: unknown): boolean {
return error instanceof ProviderRestingError;
}
