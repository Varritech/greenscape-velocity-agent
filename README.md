# greenscape-velocity-agent

Next.js application for the **Greenscape Velocity Agent** — Speed-to-Lead + Proposal Draft agent for Greenscape Pro.

Built for the License & Scale 24h take-home. See [`greenscape-velocity-infra/STRATEGY.md`](../greenscape-velocity-infra/STRATEGY.md) for the full 5-agent strategy and ROI math.

## What it does
1. GoHighLevel webhook fires on a new inbound lead.
2. Claude qualifies the lead against Greenscape's rubric (budget, lot, HOA, timeline).
3. Twilio SMS replies to the lead in under 60 seconds.
4. Slack pings #sales with the qualification summary.
5. GHL opportunity stage updates.
6. When Marcus uploads a site-walk voice memo + CompanyCam project ID, Claude drafts a proposal for Marcus to review and approve.

## Companion repos
- [`greenscape-velocity-infra`](../greenscape-velocity-infra) — schema, IaC, strategy doc, env reference
- [`greenscape-velocity-prompts`](../greenscape-velocity-prompts) — versioned Claude prompts

## Stack
Next.js 15 (App Router) · Supabase Postgres · Anthropic Claude Sonnet 4.6 · OpenAI Whisper · Twilio · GoHighLevel API v2 · Slack webhooks · Vercel

## Local dev
```bash
cp ../greenscape-velocity-infra/.env.example .env.local
# fill in secrets
pnpm install
pnpm dev
```

## Tests
```bash
pnpm test         # unit
pnpm test:e2e     # end-to-end (requires .env.local)
```

## Deploy
Vercel auto-deploys `main`. Public URL set in `NEXT_PUBLIC_APP_URL`.
