# FBI Crime Data Pipeline

Production-grade async pipeline to extract 5 years of FBI crime statistics with rate limiting, circuit breakers, and predictive analytics.

## Quick Start

```powershell
# 1. Copy environment file
cp .env.example .env
# Edit .env with your API keys

# 2. Start infrastructure
docker-compose up -d postgres redis elasticsearch

# 3. Run database migrations
python -m backend.scripts.migrate

# 4. Collect seed data
python -m backend.scripts.phase0_seed

# 5. Start workers
docker-compose up -d
```

## Architecture

- **PostgreSQL**: Source of truth (ACID writes)
- **Elasticsearch**: Fast search & analytics
- **Redis**: Job queue & circuit breaker state

## Project Structure

```
backend/
├── config/          # Settings, proxy config, offense codes
├── src/             # Core modules (<500 lines each)
├── api/             # FastAPI routes
└── scripts/         # Phase scripts
frontend/
├── src/             # Next.js 14 app
└── components/      # Dashboard, Charts, Map
```

## Environment Variables

See `.env.example` for required configuration.
