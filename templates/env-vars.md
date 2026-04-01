# Environment Variables

## Required (app won't work without these)

| Variable | Description | Where to Get |
|----------|-------------|-------------|
| `DATABASE_URL` | [Database connection string] | [Supabase dashboard / provider] |
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase project URL] | [Supabase dashboard] |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | [Supabase public key] | [Supabase dashboard] |
| | | |

## Optional (features degrade gracefully)

| Variable | Description | Feature Affected |
|----------|-------------|-----------------|
| `OPENAI_API_KEY` | [AI API access] | [AI features disabled] |
| `STRIPE_SECRET_KEY` | [Payment processing] | [Payments disabled] |
| | | |

## Server-Only (never expose to client)

| Variable | Why Server-Only |
|----------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS |
| `[API]_SECRET_KEY` | Payment/API secrets |

## Environments

| Env | .env file | Notes |
|-----|-----------|-------|
| Local | `.env.local` | Never committed |
| Preview | Vercel env vars | Auto from branch |
| Production | Vercel env vars | Manual setup |

---
*Agents use this to avoid exposing secrets, configure features correctly, and debug environment issues.*
