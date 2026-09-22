# Atlas Bodha handoff

Atlas Bodha is a Next.js conversation app. It stores users, conversations, and messages in PostgreSQL and uses an AI provider for replies.

## Local setup

Install Node.js 22, copy `.env.example` to `.env.local`, and fill in the values. Then run:

```bash
npm install
npm run db:migrate
npm run user:create -- --email you@example.com --name "Your Name"
npm run dev
```

`npm run user:create` asks for a password on the terminal. Avoid putting passwords in shell history. For production use `npm run build && npm run start`.

## Docker

```bash
docker build -t atlas-bodha .
docker run --env-file .env.local -e CODEX_AUTH_FILE=/run/codex/auth.json \
  -v "$HOME/.config/atlas-bodha/codex-auth:/run/codex:ro" \
  -p 3000:3000 atlas-bodha
```

Run migrations and create the first user from a one-off container or trusted shell using the same Neon `DATABASE_URL` before the first launch: `docker run --rm --env-file .env.local atlas-bodha npm run db:migrate`, then `docker run --rm -it --env-file .env.local atlas-bodha npm run user:create -- --email you@example.com --name "Your Name"`. Secrets are environment variables and are not placed in the image. The Codex credentials directory is mounted read-only at `/run/codex`; set `CODEX_AUTH_FILE` if it is mounted elsewhere.

## Vercel or another host

Import the repository into Vercel, set the variables listed in `.env.example`, and deploy. Vercel should use `AI_PROVIDER=openai` with Holly's `OPENAI_API_KEY`; the shared Codex auth file is for the local/Docker deployment and is not a Vercel secret. Run migrations from a trusted shell using the host's Neon `DATABASE_URL`. On another Docker host, use the Docker commands above and expose port 3000. The current live development service runs on pop-server at port 3217; there is no permanent public deployment yet.

## Holly's OpenAI key

Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in the host environment, then restart or redeploy.

## Not built yet

Long-term memory across conversations, profiles, sign-up flow, and password reset are not built yet.

## What lives where

The application code is in `~/work/atlas-bodha` on pop-server. The existing PostgreSQL database is hosted by Neon; moving the app while keeping the same database connection preserves users and conversation history. Local private settings are in `.env.local`; that file is excluded from Git and Docker. Local subscription credentials are refreshed externally into `~/.config/atlas-bodha/codex-auth/auth.json` and reread for every request. This app does not perform that refresh. Keep the directory mount so refreshed files are visible, and ensure the container's `node` user has read access without making the file public.

To reproduce the tested local production run:

```bash
npm ci
npm run db:migrate
npm run build
npm run start -- -H 0.0.0.0 -p 3217
```

For public hosting, put HTTPS in front of the app and keep `SESSION_SECURE=true`. Vercel provides HTTPS; a Docker host needs its own HTTPS endpoint. The exact local default AI model is `gpt-6-luna`. If Holly's API account uses a different model, set `AI_MODEL` to a model available to that account along with her provider and key. No SDK is required.

The reply allowance is 60 per person over a rolling 24 hours, configurable with `ATLAS_DAILY_REPLY_LIMIT`. In-flight replies reserve a slot so parallel requests cannot bypass it. The temporary developer preview endpoint is also metered so it cannot provide unlimited replies outside the cap. Safety classification uses a separate AI request and is not counted as a second reply. Unfinished or failed replies are never stored as completed assistant messages. Risk tiers are stored on completed messages; classifier reasons are neither logged nor stored.
