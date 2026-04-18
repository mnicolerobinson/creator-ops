# Creator Ops

**Clairen Haus** — autonomous multi-agent operations for creator back-office (intake, qualification, deal ops, contracts, billing, renewals, oversight).

Product direction is defined in the Creator Ops PRD (internal). Stack target for v1: **Next.js**, **Supabase** (Postgres + Auth + RLS), **Stripe Invoicing**, **Documenso** (hosted), persona-based email with approval gates and full audit logging.

## Repository status

This repository is bootstrapped for version control and CI. Application scaffolding (Next.js, Supabase migrations, workers) follows the implementation plan.

## Publish to GitHub

### Option A — GitHub website

1. Create a new empty repository (no README) at [github.com/new](https://github.com/new), e.g. `creator-ops`.
2. From this folder:

```bash
cd /Users/michellerobinson/Desktop/creator-ops
git remote add origin https://github.com/<YOUR_USER_OR_ORG>/creator-ops.git
git branch -M main
git push -u origin main
```

### Option B — GitHub CLI

Install the CLI (`brew install gh`), run `gh auth login`, then:

```bash
cd /Users/michellerobinson/Desktop/creator-ops
gh repo create creator-ops --private --source=. --remote=origin --push
```

Adjust visibility (`--public`) and name as needed.

## License

Proprietary — Clairen Haus. All rights reserved unless otherwise agreed in writing.
