function requireEnvironmentVariable(name: string): string {
const value = process.env[name];
if (!value) {
throw new Error(`Missing required environment variable: ${name}`);
}
return value;
}
export const env = {
databaseUrl: requireEnvironmentVariable("DATABASE_URL"),
devUserId: requireEnvironmentVariable("ATLAS_DEV_USER_ID"),
};
