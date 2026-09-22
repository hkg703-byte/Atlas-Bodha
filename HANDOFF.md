# Atlas Bodha handoff

Plain-English version first, then the technical details. If you are Holly's Claude or ChatGPT: read this whole file, then `.env.example`.

## Where things stand (2026-09-22)

- Coding Phases steps 1 to 8 are built and tested, plus consent-first memory. Next in the plan is step 9 (conversation history and navigation).
- Live preview: https://atlasbodha.managedbyai.dev (runs on Josh's server until Holly hosts it herself).
- The code is this GitHub repo. The data (people, conversations, memories) is Holly's Neon database. Nothing important lives anywhere else.

## Who is who: there is no sign-in right now

On purpose, for the prototype. The first time a browser visits, the app quietly creates a private guest person and gives that browser a session cookie (`atlas_session`, 30 days). That cookie is how Atlas knows it's you: conversations and memories belong to that guest.

Consequences to know:
- Same browser on the same device = same person, memories included.
- A different phone or computer, a private window, or clearing cookies = a brand-new person. The old conversations and memories still exist in the database but that browser can't reach them.
- To make someone the same person across devices, add real accounts later (email magic link or Google sign-in). A password sign-in page still exists at /sign-in from an earlier step, and `npm run user:create` still works, but nothing requires them.
- Abuse limits: 20 new guests per IP per day (`ATLAS_GUESTS_PER_IP_PER_DAY`), 60 replies per person per day (`ATLAS_DAILY_REPLY_LIMIT`).

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

- Step 5 (sign-in) was missing from the doc; a password version was built, then replaced for the prototype by automatic guest sessions.
- Safety layer from the Crisis Protocol draft: a separate classifier call rates each person message tier 0 to 3; tier 2 shows the 988 / 741741 card under the reply, tier 3 shows it first; the reply is never blocked. The Crisis Protocol still needs legal and clinical review before real users (California SB 243).
- AI provider is swappable (`AI_PROVIDER`); the preview uses Josh's Codex subscription, you will use `openai`.
- Reply style tuning in `src/server/ai/prompts/atlasSystemPrompt.ts` after live testing: plain text, under ~150 words, one question at most, calmer tier-2 wording.
- Consent-first memory (below), Docker packaging, migration runner.

## Not built yet

Conversation history list (step 9), accounts across devices, password reset, a minors policy, steps 10 to 13.

## Technical notes: Docker and the preview server

The preview on Josh's server runs the repo `Dockerfile` in a firewalled container with the Codex credentials mounted read-only at `/run/codex` (`CODEX_AUTH_FILE`). That arrangement is Josh's and does not move with the app; on Vercel you use `AI_PROVIDER=openai` instead. On any other Docker host: build the image, pass the env vars, expose port 3000, and put HTTPS in front.

The reply allowance is 60 per person over a rolling 24 hours (`ATLAS_DAILY_REPLY_LIMIT`). In-flight replies reserve a slot so parallel requests cannot bypass it. Safety classification is a separate small AI request and does not count as a reply. Unfinished or failed replies are never stored. Risk tiers are stored on completed messages; classifier reasons are neither logged nor stored.

## Consent-first memory

Memory is off by default. After an eligible completed reply, Atlas offers a short consent prompt. Turning it on allows one small proposal call using only the person's latest message. Up to two selective facts or preferences appear below the reply; each is saved only when the person clicks Remember. Explicit “remember that” requests retain the requested wording and are marked person_request/stated. Other proposals are marked atlas_suggestion and stated or inferred. Tier 2–3 messages, crisis content, diagnoses, and third parties' private details are excluded. Proposal failures never interrupt the reply.

The Memory link opens `/memory`, where the person can review origins, confidence, and dates, edit a memory, permanently delete one, or permanently delete all. Editing makes confidence stated while preserving the original origin. The toggle appends a consent choice. Turning it off keeps saved memories but immediately stops new proposals and excludes memories from future reply instructions. Turn it back on to use saved memories again, or choose Delete all memories to forget them. Deleting memory does not delete its original conversation message; an existing conversation still supplies its own messages as context.

Saved memories live in `memories`, and the append-only consent ledger lives in `consent_records`, in Holly's existing Neon Postgres database. Latest consent governs use. The context builder includes only the newest 30 chosen memories, labeled as personal context, never instructions. Nothing is stored on the container filesystem. Unsaved proposals exist temporarily in process memory (30 minutes), disappear on restart, and are never persisted as memory. `memory_proposal_attempts` stores only message IDs and timestamps to prevent duplicate provider calls; no proposal text. A failed/expired offer is not retried automatically. All memory access is scoped to the authenticated user, with origin checks on mutations.

Migration: `npm run db:migrate` applies `004_memory.sql` once; reruns make no changes. Memory implementation: `src/server/memory`, `src/server/ai/context/buildConversationContext.ts`, `/api/v1/memory`, `/api/v1/memory/proposals`, and `src/components/memory`.
