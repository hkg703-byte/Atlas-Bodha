import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

type Arguments = { email: string; name?: string };

function readArguments(): Arguments {
  const values = new Map<string, string>();
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}`);
    }
    values.set(argument.slice(2), value);
    index += 1;
  }

  const email = values.get("email")?.trim().toLowerCase();
  const name = values.get("name")?.trim() || undefined;
  if (!email) {
    throw new Error("Usage: npm run user:create -- --email <email> [--name <name>]");
  }

  return { email, name };
}

async function main() {
  loadEnvConfig(process.cwd());
  const args = readArguments();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const databaseUrl = new URL(connectionString);
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname.endsWith(".neon.tech")
  ) {
    throw new Error("Refusing to connect: DATABASE_URL is not a Neon database");
  }

  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`atlas-email:${args.email}`],
    );

    const identities = await client.query<{ user_id: string; display_name: string }>(
      `
        SELECT user_id, display_name
        FROM external_identities
        WHERE provider IN ('email', 'password')
          AND lower(subject) = $1
        ORDER BY CASE provider WHEN 'email' THEN 0 ELSE 1 END;
      `,
      [args.email],
    );

    const userIds = new Set(identities.rows.map((identity) => identity.user_id));
    if (userIds.size > 1) {
      throw new Error("Conflicting identities already exist for this email");
    }

    let userId = identities.rows[0]?.user_id;
    let createdUser = false;
    if (!userId) {
      const userResult = await client.query<{ id: string }>(
        "INSERT INTO users DEFAULT VALUES RETURNING id;",
      );
      userId = userResult.rows[0].id;
      createdUser = true;
    }

    const existingEmailIdentity = await client.query(
      `SELECT 1 FROM external_identities WHERE provider = 'email' AND lower(subject) = $1`,
      [args.email],
    );
    if (existingEmailIdentity.rowCount === 0) {
      await client.query(
        `
          INSERT INTO external_identities (user_id, provider, subject, display_name)
          VALUES ($1, 'email', $2, $3);
        `,
        [userId, args.email, args.name ?? identities.rows[0]?.display_name ?? args.email],
      );
    }

    await client.query("COMMIT");
    process.stdout.write(
      `${createdUser ? "Created" : "Reused"} Atlas Bodha user ${args.email}\n`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  void error;
  process.stderr.write("User creation failed\n");
  process.exitCode = 1;
});
