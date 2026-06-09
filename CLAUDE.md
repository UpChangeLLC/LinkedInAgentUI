# CLAUDE.md

## Project Overview

LinkedIn AI Resilience Score - a full-stack application that analyzes LinkedIn profiles and generates an AI resilience assessment with actionable recommendations. FastAPI backend with LangGraph AI pipeline, React/Vite frontend with Tailwind CSS.

## Architecture

```
Backend/           FastAPI server (mcp_http.py is the entrypoint)
  routes/          API routers: agent, health, stats, actions, teams, reports
  services/        Business logic: apify_cache, benchmark, pdf, certificate, taxonomy, learning_matcher, github, website, company
  alembic/         Database migrations (3 versions: 001 base, 002 history+actions, 003 teams)
  prompts.py       LLM prompt templates (v1 + v2 with evidence layer)
  ai_backend.py    Core AI pipeline: LangGraph agent, Apify scraping, OpenAI/Anthropic
  db.py            Async SQLAlchemy engine + session factory
  db_models.py     ORM models (8 tables: pipeline_runs, analytics_events, apify_cache, assessment_history, action_items, teams, team_members, plus alembic_version)
  cache.py         Redis client factory + cache helpers
  middleware.py     CORS, rate limiting, security headers
Frontend/
  src/pages/       6 pages: Landing, IntakeForm, ProfilePreview, Analyzing, ResultsDashboard, Error
  src/components/  dashboard/ (20+ section components), ui/ (reusable components), landing/
  src/lib/         transform.ts (API→UI mapping), mcp.ts (API client), schemas.ts (Zod), analytics.ts, scoreUtils.ts, shareUtils.ts, config.ts
  src/data/        mockResults.ts (TypeScript interfaces + mock data)
```

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async) + asyncpg, Alembic, Redis (hiredis), LangGraph, OpenAI/Anthropic SDKs, Sentry
- **Frontend**: React 18, TypeScript, Vite 5, Tailwind CSS 3, Framer Motion, Lucide icons, Zod, Sentry
- **Infrastructure**: Docker Compose (PostgreSQL 17, Redis 7), GitHub Actions CI, Render deployment

## Key Commands

```bash
# Local development (Docker)
docker compose up -d              # Start all services (app on :8001, postgres on :5433, redis on :6380)
docker compose up -d --build app  # Rebuild and restart app only
docker compose logs -f app        # Tail app logs

# Backend tests
cd Backend && python -m pytest tests/ -v

# Frontend tests
cd Frontend && npx vitest run

# Frontend dev server (standalone, without Docker)
cd Frontend && npm run dev        # Vite dev server on :5173

# Database migrations
cd Backend && python -m alembic upgrade head
cd Backend && python -m alembic revision --autogenerate -m "description"

# Type checking
cd Frontend && npx tsc --noEmit

# Production build
cd Frontend && npx vite build
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health`, `/ready` | Health checks |
| POST | `/mcp/run` | Run AI analysis pipeline |
| POST | `/mcp/preview` | Quick preview (no full pipeline) |
| POST | `/mcp/run/stream` | SSE streaming analysis |
| GET | `/api/stats` | Aggregate assessment stats |
| GET | `/api/benchmarks?role=&industry=` | Peer benchmarks |
| GET | `/api/history/{url_hash}` | Assessment history timeline |
| GET | `/api/actions/{url_hash}` | Action items for a profile |
| PATCH | `/api/actions/{action_id}` | Update action status |
| POST | `/api/teams` | Create team challenge |
| POST | `/api/teams/{code}/join` | Join team |
| GET | `/api/teams/{code}/leaderboard` | Team leaderboard |
| GET | `/api/reports/{run_id}/pdf` | Download PDF report |
| GET | `/api/certificates/{run_id}` | Download PNG certificate |
| GET | `/api/news-feed` | AI news discovery links |
| GET | `/api/community-insights` | Anonymous aggregate trends |
| GET | `/api/learning-resources` | Curated learning resources |
| POST | `/api/events` | Frontend analytics events |

## Environment Variables

**Single source of truth: the gitignored root `.env`** (`LinkedInAgentUI/.env`). It holds both backend runtime config and frontend build vars. How it's consumed:
- **Docker:** `docker-compose.yml` loads it as the backend `env_file` (runtime `os.getenv`) and passes the `VITE_*` keys as build args → the Dockerfile exports them as ENV so Vite bakes them into the bundle.
- **Local backend:** `load_dotenv()` walks up from `Backend/` to find the root `.env`.
- **Local frontend (`npm run dev`/build):** `vite.config.ts` sets `envDir: '..'` to read the root `.env`.

`VITE_*` vars are exposed to the browser; everything else is server-side only (never bundled). DB/Redis URLs in `.env` use the Docker service hostnames (`db:5432`, `redis:6379`); override for non-Docker local runs.

Backend keys: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (LLM), `DATABASE_URL`, `REDIS_URL`, `APIFY_API_TOKEN`, `FRONTEND_ORIGIN` (CORS), `SENTRY_DSN`, `MCP_API_KEY` (must match `VITE_MCP_API_KEY`), `FEATURE_CHAT_SESSIONS`, `PAYMENT_PROVIDER` (`mock`|`razorpay`|`stripe`), Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, optional `STRIPE_SUCCESS_URL`/`STRIPE_CANCEL_URL`).

Frontend (`VITE_`) keys: `VITE_MCP_BASE_URL` (empty = same origin), `VITE_MCP_API_KEY`, `VITE_COMMUNITY_URL` (Discourse forum; dashboard "Community" nav link, hidden when unset), `VITE_SENTRY_DSN` (optional).

## Code Conventions

- **Backend imports**: Use `import.meta` style env access is NOT available; use `os.getenv()`
- **Frontend env access**: Always use `(import.meta as any).env?.VITE_*` pattern (not bare `import.meta.env`)
- **Database operations**: Use fire-and-forget pattern for non-critical writes (history, analytics). Wrap in try/except, log errors, never block the response
- **API responses**: All endpoints gracefully handle missing DB/Redis - return empty/default data instead of 500s
- **Transform layer**: `Frontend/src/lib/transform.ts` maps snake_case API responses to camelCase frontend interfaces. All new API fields must be added here
- **Dashboard sections**: Each section is a standalone component in `components/dashboard/`. Register in `Sidebar.tsx` (nav items) and `ResultsDashboard.tsx` (switch cases)
- **Styling**: Tailwind utility classes. LinkedIn blue is `text-linkedin` / `bg-linkedin`. No CSS modules
- **Animations**: Framer Motion for page transitions and interactive elements
- **Types**: All data interfaces defined in `Frontend/src/data/mockResults.ts`

## Testing

- **Backend**: pytest + pytest-asyncio. Tests in `Backend/tests/`. Uses `httpx.AsyncClient` with `ASGITransport` for zero-network testing. 24 tests covering health, routes, actions, teams, stats, and services
- **Frontend**: Vitest + @testing-library/react. Tests colocated in `__tests__/` directories. 22 tests covering transform logic, UI components, and data validation
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) runs both test suites + Docker build on push

## Common Pitfalls

- **Bundle size**: Vite manual chunking in `vite.config.ts` keeps chunks under 250KB. Adding large deps requires updating `manualChunks`
- **Dockerfile**: Uses `npm install` (not `npm ci`) for cross-platform lockfile compatibility (macOS dev -> linux Docker)
- **Pre-existing TS errors**: `Button.tsx` has a framer-motion type incompatibility (`onDrag`). Not from our changes, ignore it
- **Alembic in Docker**: Migrations run automatically on container start (`CMD` runs `alembic upgrade head` before uvicorn)
- **Render deployment**: `render.yaml` in `Backend/`. Render provides `postgres://` URLs which `db.py` auto-converts to `postgresql+asyncpg://`
