# Architecture

## System Overview

```
[Client] → [Frontend] → [API Layer] → [Database]
                ↓              ↓
           [Auth]         [External APIs]
```

## Frontend
- **Framework**: [Next.js / React / Vue / etc.]
- **Routing**: [App Router / Pages Router / file-based]
- **State Management**: [React Context / Zustand / Redux / etc.]
- **Styling**: [TailwindCSS / CSS Modules / styled-components]

## Backend / API
- **Type**: [Next.js API Routes / Express / serverless]
- **Authentication**: [Supabase Auth / NextAuth / custom]
- **Database**: [Supabase / PostgreSQL / MongoDB]
- **ORM**: [Prisma / Drizzle / Supabase client]

## External Services
| Service | Purpose | Auth Method |
|---------|---------|-------------|
| [e.g., OpenAI] | [AI generation] | [API key] |
| [e.g., Stripe] | [Payments] | [API key + webhook] |

## Directory Structure
```
src/
├── app/          [pages and API routes]
├── components/   [React components]
├── lib/          [utilities and helpers]
└── [other dirs]
```

## Key Patterns
- [e.g., "Server components by default, 'use client' only when needed"]
- [e.g., "All DB access through lib/supabase/ helpers"]
- [e.g., "API routes validate input with zod"]

## Deploy
- **Platform**: [Vercel / AWS / etc.]
- **CI/CD**: [GitHub Actions / Vercel auto-deploy]
- **Environments**: [dev, staging, prod]

---
*Agents use this to understand system boundaries, make architecture-consistent decisions, and avoid breaking existing patterns.*
