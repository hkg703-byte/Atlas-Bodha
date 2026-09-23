# Atlas Bodha handoff

Plain-English version first, then the technical details. If you are Holly's Claude or ChatGPT: read this whole file, then `.env.example`.

## Where things stand (2026-09-22)

- Coding Phases steps 1 to 8 are built and tested, plus consent-first memory. Next in the plan is step 9 (conversation history and navigation).
- Live preview: https://atlasbodha.managedbyai.dev (runs on Josh's server until Holly hosts it herself).
- The code is this GitHub repo. The data (people, conversations, memories) is Holly's Neon database. Nothing important lives anywhere else.

## Sign-in and accounts

Atlas requires sign-in. Enter an email at `/sign-in`; the same one-time magic-link flow creates new adult accounts and signs existing people in. New account details include an optional first name and required 18+ attestation. Responses do not reveal whether an account already exists. Links expire after 10 minutes and work once. Guest mode has been removed; existing guest records remain in Neon and are not deleted.

Abuse limits: 3 sign-in link requests per email per 15 minutes, 10 per IP per hour, 50 new accounts per Pacific calendar day (`ATLAS_DAILY_SIGNUP_LIMIT`), 60 replies per person over a rolling 24 hours (`ATLAS_DAILY_REPLY_LIMIT`), and 400 assistant replies globally per Pacific calendar day (`ATLAS_GLOBAL_DAILY_REPLY_LIMIT`).

## Moving it to your own setup (Vercel is the easiest)

1. Make a free Vercel account by signing in with the GitHub account that owns this repo.
2. In Vercel: Add New Project, import this repo.
3. Add these environment variables (see `.env.example` for all of them):
   - `DATABASE_URL`: your Neon connection string (Neon dashboard, Connect). Same database = everything carries over.
   - `AI_PROVIDER=openai`
   - `OPENAI_API_KEY`: from platform.openai.com. Set a monthly spending limit there first.
   - `AI_MODEL`: a model your OpenAI account offers (the preview uses `gpt-6-luna`, which is a Codex-subscription name and may not exist on your API account).
   - `AI_REASONING_EFFORT=medium`
   - `SESSION_SECURE=true`
4. Deploy. Vercel gives you a web address; connect your own domain in Vercel's Domains settings once you buy it.
5. Tell Josh, so he can shut down the preview on his server.

The database tables already exist. If you ever point at a fresh database, run `npm run db:migrate` once from a computer with Node 22 and `DATABASE_URL` set.

## Working on the code yourself

```bash
git clone <this repo>
cd Atlas-Bodha
npm install
cp .env.example .env.local   # then fill in DATABASE_URL, AI_PROVIDER=openai, OPENAI_API_KEY, AI_MODEL
npm run dev                  # open http://localhost:3000
```

`.env.local` holds secrets and is never committed. Run `npm run lint` and `npm run build` before pushing.

## What was built beyond the Coding Phases doc

- Step 5 uses adult-only email magic-link sign-up and sign-in. Password and guest sign-in have been removed.
- Safety layer from the Crisis Protocol draft: a separate classifier call rates each person message tier 0 to 3; tier 2 shows the 988 / 741741 card under the reply, tier 3 shows it first; the reply is never blocked. The Crisis Protocol still needs legal and clinical review before real users (California SB 243).
- AI provider is swappable (`AI_PROVIDER`); the preview uses Josh's Codex subscription, you will use `openai`.
- Reply style tuning in `src/server/ai/prompts/atlasSystemPrompt.ts` after live testing: plain text, under ~150 words, one question at most, calmer tier-2 wording.
- Consent-first memory (below), Docker packaging, migration runner.

## Not built yet

Conversation history list (step 9), accounts across devices, password reset, a minors policy, steps 10 to 13.

## Technical notes: Docker and the preview server

The preview on Josh's server runs the repo `Dockerfile` in a firewalled container with the Codex credentials mounted read-only at `/run/codex` (`CODEX_AUTH_FILE`). That arrangement is Josh's and does not move with the app; on Vercel you use `AI_PROVIDER=openai` instead. On any other Docker host: build the image, pass the env vars, expose port 3000, and put HTTPS in front.

The reply allowance is 60 per person over a rolling 24 hours (`ATLAS_DAILY_REPLY_LIMIT`) and 400 globally per Pacific calendar day (`ATLAS_GLOBAL_DAILY_REPLY_LIMIT`). In-flight replies reserve a slot so parallel requests cannot bypass it. Safety classification is a separate small AI request and does not count as a reply. Unfinished or failed replies are never stored. Risk tiers are stored on completed messages; classifier reasons are neither logged nor stored.

## Consent-first memory

Memory is off by default. After an eligible completed reply, Atlas offers a short consent prompt. Turning it on allows one small proposal call using only the person's latest message. Up to two selective facts or preferences appear below the reply; each is saved only when the person clicks Remember. Explicit “remember that” requests retain the requested wording and are marked person_request/stated. Other proposals are marked atlas_suggestion and stated or inferred. Tier 2–3 messages, crisis content, diagnoses, and third parties' private details are excluded. Proposal failures never interrupt the reply.

The Memory link opens `/memory`, where the person can review origins, confidence, and dates, edit a memory, permanently delete one, or permanently delete all. Editing makes confidence stated while preserving the original origin. The toggle appends a consent choice. Turning it off keeps saved memories but immediately stops new proposals and excludes memories from future reply instructions. Turn it back on to use saved memories again, or choose Delete all memories to forget them. Deleting memory does not delete its original conversation message; an existing conversation still supplies its own messages as context.

Saved memories live in `memories`, and the append-only consent ledger lives in `consent_records`, in Holly's existing Neon Postgres database. Latest consent governs use. The context builder includes only the newest 30 chosen memories, labeled as personal context, never instructions. Nothing is stored on the container filesystem. Unsaved proposals exist temporarily in process memory (30 minutes), disappear on restart, and are never persisted as memory. `memory_proposal_attempts` stores only message IDs and timestamps to prevent duplicate provider calls; no proposal text. A failed/expired offer is not retried automatically. All memory access is scoped to the authenticated user, with origin checks on mutations.

Migration: `npm run db:migrate` applies `004_memory.sql` once; reruns make no changes. Memory implementation: `src/server/memory`, `src/server/ai/context/buildConversationContext.ts`, `/api/v1/memory`, `/api/v1/memory/proposals`, and `src/components/memory`.

## Email sign-up and sign-in

Set `APP_BASE_URL` to the public HTTPS origin, `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM_NAME=Atlas Bodha`, and `EMAIL_FROM_ADDRESS=atlas@managedbyai.dev`. The local Brevo credential file is `~/.config/atlas-bodha/brevo.env`; it is private and must be loaded into the process environment by the launcher, never committed. Next automatically loads `.env.local`, not that separate file.

`/sign-in` always displays email, optional first name, and the required “I'm 18 or older” attestation. New and returning people receive the same response. The first name and attestation timestamp travel with the hashed token record and are stored on the user when created. Existing password identities attach an email identity to the same user; their history and memories stay intact. Password credentials remain in the database solely for preservation, with no password login endpoint.

Links contain 32 random bytes, last 10 minutes and work once. Only SHA-256 hashes are stored. Verification, identity creation and session creation commit together. The database enforces 3 requests per email per 15 minutes and 10 per IP per hour, including failed delivery attempts. A trusted reverse proxy must overwrite `X-Forwarded-For` before setting `TRUST_PROXY_IP=true`; otherwise all requests safely share a single IP bucket. Never enable that option on a directly exposed server. The daily signup cap (`ATLAS_DAILY_SIGNUP_LIMIT`, default 50) uses the Pacific calendar day and serializes account creation. Existing users can still sign in when signup is capped. Admin CLI creation also counts toward the next web signup check.

For local development only, `EMAIL_PROVIDER=console` prints the link to server stdout. It refuses to run in production. Never save or share these logs. Development HTTP request logging is disabled so verification URLs are not logged independently of the provider. Configure hosting/proxy access logs to redact query strings for `/auth/verify`; do not collect these URLs in analytics. Verification responses use no-store and no-referrer and redirect immediately to a clean URL.

Holly can use her own Brevo key and verified sender by changing environment variables and restarting. To swap providers without code changes, set `EMAIL_PROVIDER=resend` plus `RESEND_API_KEY`, or `EMAIL_PROVIDER=postmark` plus `POSTMARK_SERVER_TOKEN`; keep the same `EMAIL_FROM_*` variables and verify that sender with the chosen service. The small `EmailSender` interface in `src/server/email/emailSender.ts` isolates delivery from authentication.

`ATLAS_GLOBAL_DAILY_REPLY_LIMIT` defaults to 400 across all users, alongside the existing per-user cap. In-flight replies reserve capacity. At capacity the app says “Atlas is resting” and asks the person to return later. `AI_REASONING_EFFORT=low|medium|high` selects reply reasoning, default `medium`; safety classification and memory proposals stay `low`. `AI_MODEL` remains `gpt-6-luna` by default.

Migration `005_magic_links.sql` is additive and preserves all existing data. Apply with `npm run db:migrate`; reruns are no-ops.

Email delivery uses `EMAIL_PROVIDER=brevo` by default. Holly can change it to `resend` or `postmark` and provide the matching provider key, or use `console` only in local development. Set `APP_BASE_URL` to the public HTTPS origin.
