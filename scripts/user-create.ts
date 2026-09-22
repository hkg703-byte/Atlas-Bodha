import { stdin, stderr } from "node:process";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { hashPassword } from "../src/server/auth/password";

type Arguments = { email: string; name: string; password?: string };

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
  const name = values.get("name")?.trim();
  if (!email || !name) {
    throw new Error("Usage: npm run user:create -- --email <email> --name <name> [--password <password>]");
  }

  return { email, name, password: values.get("password") };
}

async function readPassword(): Promise<string> {
  stderr.write("Password: ");

  if (!stdin.isTTY) {
    let input = "";
    for await (const chunk of stdin) input += chunk.toString();
    stderr.write("\n");
    return input.replace(/[\r\n]+$/, "");
  }

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let password = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
    };

    stdin.on("data", function onData(character: string) {
      if (character === "\r" || character === "\n") {
        stdin.off("data", onData);
        cleanup();
        resolve(password);
      } else if (character === "\u0003") {
        stdin.off("data", onData);
        cleanup();
        reject(new Error("Cancelled"));
      } else if (character === "\u007f") {
        password = password.slice(0, -1);
      } else {
        password += character;
      }
    });
  });
}

async function main() {
  loadEnvConfig(process.cwd());
  const args = readArguments();
  const password = args.password ?? (await readPassword());
  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const databaseUrl = new URL(connectionString);
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname.endsWith(".neon.tech")
  ) {
    throw new Error("Refusing to connect: DATABASE_URL is not a Neon database");
  }

  const { salt, hash } = await hashPassword(password);
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userResult = await client.query<{ id: string }>(
      "INSERT INTO users DEFAULT VALUES RETURNING id;",
    );
    await client.query(
      `
        INSERT INTO external_identities
          (user_id, provider, subject, display_name, password_salt, password_hash)
        VALUES ($1, 'password', $2, $3, $4, $5);
      `,
      [userResult.rows[0].id, args.email, args.name, salt, hash],
    );
    await client.query("COMMIT");
    process.stdout.write(`Created Atlas Bodha user ${args.email}\n`);
  } catch {
    await client.query("ROLLBACK");
    throw new Error("User creation failed");
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
