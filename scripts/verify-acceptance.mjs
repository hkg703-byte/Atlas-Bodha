// Runs against the configured Neon database and an already running production server.
// Password and cookies stay in private files/stdin, never command arguments or output.
import { spawn } from 'node:child_process';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { Client } from 'pg';

const base = process.env.ATLAS_TEST_BASE_URL || 'http://localhost:3217';
const config = `${homedir()}/.config/atlas-bodha`;
const jar = `${config}/test-cookies.txt`;
const evidence = [];
function log(s) { evidence.push(s); console.log(s); }
function check(condition, label) { if (!condition) throw new Error(label); }
async function curl(path, { method = 'GET', data, authenticated = true, saveCookies = false } = {}) {
  const args = ['--silent', '--show-error', '--max-time', '30', '--request', method,
    '--write-out', '\n%{http_code}', `${base}${path}`];
  if (method !== 'GET') args.push('--header', `Origin: ${new URL(base).origin}`);
  if (authenticated) args.push('--cookie', jar);
  if (saveCookies) args.push('--cookie-jar', jar);
  if (data !== undefined) args.push('--header', 'Content-Type: application/json', '--data-binary', '@-');
  return new Promise((resolve, reject) => {
    const child = spawn('curl', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.resume(); // Never emit request diagnostics that could contain credentials.
    child.on('error', () => reject(new Error('curl invocation failed')));
    child.on('close', code => {
      if (code !== 0) return reject(new Error('curl request failed'));
      const at = output.lastIndexOf('\n');
      const body = output.slice(0, at);
      resolve({ status: Number(output.slice(at + 1)), body, json: () => JSON.parse(body) });
    });
    child.stdin.end(data === undefined ? undefined : JSON.stringify(data));
  });
}

let db;
try {
  check(new URL(process.env.DATABASE_URL).hostname.endsWith('.neon.tech'), 'Refusing non-Neon database');
  await writeFile(jar, '', { mode: 0o600 });
  await chmod(jar, 0o600);
  const root = await fetch(base, { redirect: 'manual' });
  check([302, 303, 307, 308].includes(root.status) && new URL(root.headers.get('location'), base).pathname === '/sign-in', 'Unauthenticated root must redirect');
  log(`Unauthenticated GET /: ${root.status}, Location pathname /sign-in`);
  let r = await curl('/api/v1/conversations', { method: 'POST', data: { content: 'unauthenticated' }, authenticated: false });
  check(r.status === 401, 'Unauthenticated API must be 401');
  log(`Unauthenticated POST /api/v1/conversations: ${r.status} ${r.body}`);

  const password = (await readFile(`${config}/test-user.txt`, 'utf8')).trim();
  r = await curl('/api/auth/sign-in', { method: 'POST', data: { email: 'josh-test@atlasbodha.local', password }, authenticated: false, saveCookies: true });
  check([200, 303].includes(r.status), 'Test sign-in failed');
  log(`curl sign-in with private cookie jar: ${r.status}; credentials and cookie values suppressed`);
  const cookieFile = await readFile(jar, 'utf8');
  check(cookieFile.includes('atlas_session'), 'Session cookie missing');
  const cookieLine = cookieFile.split('\n').find(line => line.includes('\tatlas_session\t'));
  check(cookieLine?.startsWith('#HttpOnly_') && cookieLine.split('\t')[3] === 'TRUE', 'Production cookie must be HttpOnly and Secure');
  log('Production session cookie: HttpOnly and Secure confirmed');

  r = await curl('/api/health/database');
  check(r.status === 200 && r.json().status === 'ok', 'Database health failed');
  log(`Authenticated database health: ${r.status} ${r.body}`);
  r = await curl('/api/v1/conversations', { method: 'POST', data: { content: 'Gate first message' } });
  check(r.status === 201, 'Create conversation failed');
  const conversationId = r.json().data.conversationId;
  log(`Create conversation: ${r.status}, conversationId=${conversationId}, sequenceNumber=${r.json().data.message.sequenceNumber}`);
  const path = `/api/v1/conversations/${conversationId}/messages`;
  for (const content of ['Gate second message', 'Gate third message']) {
    r = await curl(path, { method: 'POST', data: { content } });
    check(r.status === 201, 'Sequential append failed');
    log(`Append: ${r.status}, sequenceNumber=${r.json().data.message.sequenceNumber}`);
  }
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let rows = (await db.query('SELECT sequence_number::text, role, content FROM messages WHERE conversation_id=$1 ORDER BY sequence_number', [conversationId])).rows;
  check(rows.length === 3 && rows.map(r => r.sequence_number).join(',') === '1,2,3', 'Three-message sequence check failed');
  log(`Direct Neon query after two appends: ${JSON.stringify(rows)}`);
  const responses = await Promise.all(Array.from({ length: 5 }, (_, i) => curl(path, { method: 'POST', data: { content: `Concurrent message ${i + 1}` } })));
  check(responses.every(r => r.status === 201), 'Concurrent append failed');
  const sequences = responses.map(r => r.json().data.message.sequenceNumber).sort((a, b) => Number(a) - Number(b));
  check(sequences.join(',') === '4,5,6,7,8', 'Concurrent returned sequences failed');
  log(`Five concurrent curl appends: statuses=${responses.map(r => r.status).join(',')}; sequences=${sequences.join(',')}`);
  rows = (await db.query('SELECT sequence_number::text, role FROM messages WHERE conversation_id=$1 ORDER BY sequence_number', [conversationId])).rows;
  check(rows.length === 8 && rows.map(r => r.sequence_number).join(',') === '1,2,3,4,5,6,7,8', 'Concurrent database rows failed');
  log(`Direct Neon query after concurrency: rowCount=${rows.length}; unique consecutive sequences=${rows.map(r => r.sequence_number).join(',')}`);
  r = await curl(path);
  check(r.status === 200 && r.json().data.messages.length === 8, 'Authorized list failed');
  log(`GET messages: ${r.status}, count=${r.json().data.messages.length}`);
  r = await curl(`/conversations/${conversationId}`);
  check(r.status === 200 && r.body.includes('Gate first message') && r.body.includes('Concurrent message 5'), 'Persisted conversation page failed');
  log(`Reload conversation page: ${r.status}; persisted first and concurrent messages present`);
  for (const content of ['', ' '.repeat(3), 'a'.repeat(20001)]) {
    r = await curl(path, { method: 'POST', data: { content } });
    check(r.status === 400, 'Invalid content was accepted');
  }
  log('Blank, whitespace-only, and oversized appends: 400,400,400');
  r = await curl('/api/v1/conversations/00000000-0000-4000-8000-000000000000/messages', { method: 'POST', data: { content: 'Missing' } });
  check(r.status === 404, 'Missing conversation append must be 404');
  log(`Missing conversation append: ${r.status}`);
  const prior = await db.query('SELECT id FROM conversations WHERE user_id <> (SELECT user_id FROM external_identities WHERE provider=$1 AND subject=$2) LIMIT 1', ['password', 'josh-test@atlasbodha.local']);
  if (prior.rows.length) {
    r = await curl(`/api/v1/conversations/${prior.rows[0].id}/messages`, { method: 'POST', data: { content: 'Unauthorized write attempt' } });
    check(r.status === 404, 'Cross-user append was not denied');
    log(`Other user's conversation append: ${r.status}`);
  }
  await writeFile(`${config}/acceptance-conversation.txt`, `${conversationId}\n`, { mode: 0o600 });
  log('Acceptance API/database checks: PASS');
} catch (error) {
  // Only controlled labels may be printed. Driver errors can contain connection data.
  log('Acceptance API/database checks: FAILED (raw error suppressed)');
  if (error instanceof Error && !('code' in error)) log(`Check: ${error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')}`);
  process.exitCode = 1;
} finally {
  await db?.end().catch(() => {});
  await writeFile(`${config}/acceptance-output.txt`, `${evidence.join('\n')}\n`, { mode: 0o600 });
}
