// Explicitly invoked smoke test: sends ONE email, only to Josh, with [test].
import { loadEnvConfig } from '@next/env';
import { homedir } from 'node:os';
import { join } from 'node:path';

async function main() {
  loadEnvConfig(process.cwd());
  process.loadEnvFile(join(homedir(), '.config/atlas-bodha/brevo.env'));
  process.env.EMAIL_PROVIDER = 'brevo';
  process.env.APP_BASE_URL = 'http://localhost:3220';
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input) !== 'https://api.brevo.com/v3/smtp/email' || ++calls !== 1) throw new Error('Unexpected send');
    const body = JSON.parse(String(init?.body));
    if (body.to.length !== 1 || body.to[0].email !== 'jkm1317@gmail.com') throw new Error('Unexpected recipient');
    body.subject = '[test] ' + body.subject;
    const response = await originalFetch(input, { ...init, body: JSON.stringify(body) });
    const result = await response.clone().json();
    if (response.status !== 201 || typeof result.messageId !== 'string') throw new Error('Provider acceptance failed');
    console.log('Brevo HTTP 201; messageId received (redacted)');
    return response;
  };
  const { requestMagicLink } = await import('../src/server/auth/magicLink');
  await requestMagicLink('jkm1317@gmail.com', '', 'brevo-authorized-test');
  if (calls !== 1) throw new Error('Email rate limit prevented test');
  const { dbPool } = await import('../src/lib/db/pool');
  await dbPool.end();
}
main().catch(() => { console.error('Brevo test failed (details withheld)'); process.exit(1); });
