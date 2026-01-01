# 🚨 FBI Crime Data Pipeline v2.0
> **Mission-Critical Analytics for National & Regional Crime Trends**

[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/) 
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100+-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-grade, asynchronous data pipeline engineered to extract, enrich, and visualize 5+ years of FBI crime statistics. Version 2.0 introduces full-stack containerization, optimized search indices, and a streamlined developer workspace.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph "External Data"
        FBI_API["FBI CDE API"]
    end

    subgraph "Backend Tier (FastAPI)"
        DashboardAPI["Dashboard API (Port 49080)"]
        AdminAPI["Admin API (Port 49081)"]
        TaskFetcher["Async Crime Worker"]
    end

    subgraph "Persistence & Cache"
        PG[("PostgreSQL\nSource of Truth")]
        ES[("Elasticsearch\nSearch & Aggregations")]
        Redis[("Redis\nJob Queue & CB")]
    end

    subgraph "Frontend Tier (Next.js)"
        Dashboard["Main Dashboard\n(Port 49000)"]
    end

    FBI_API --> TaskFetcher
    TaskFetcher --> PG
    PG --> ES
    DashboardAPI --> ES
    Dashboard --> DashboardAPI
```

---

## ✨ Release v2.0 Highlights

- **🚀 49k Port Series**: Standardized unified port mapping for all services.
- **🧱 Full Containerization**: One-command deployment for the entire stack.
- **🔍 Elastic Analytics**: Real-time aggregation of crime rates per 100k residents.
- **🧹 Optimized Workspace**: Consolidated dev tools and a cleansed root directory.
- **📱 Responsive UI**: Enhanced dashboard with adaptive typography and right-aligned stats.

---

## 🛠️ Project Geography

```
├── backend/            # Python FastAPI Backend
│   ├── api/            # Production API Routes
│   ├── config/         # System & Offense Configurations
│   ├── src/            # Core Engine (Circuit Breakers, Workers)
│   ├── scripts/        # Data Lifecycle (Seeding, Pilots)
│   └── tools/          # Dev & Maintenance Toolbox
├── frontend/           # Next.js Analytics Dashboard
│   ├── src/components/ # Modern, responsive UI components
│   └── src/lib/        # Type-safe API client & shared utils
├── k8s/                # Kubernetes Deployment Manifests
└── rebuild.ps1         # Unified Automation Script
```

---

## 🚀 Getting Started

### 1. Environmental Setup
```powershell
cp .env.example .env
# Important: Update FBI_API_KEY and DATABASE_URL
```

### 2. Launch the Ecosystem
Our Version 2 logic utilizes a unified rebuild script that handles infrastructure, migrations, and builds:
```powershell
./rebuild.ps1
```

### 3. Verification
Access your unified dashboard at:
👉 **[http://localhost:49000](http://localhost:49000)**

---

## ☁️ Deployment Guides

Ready to take your data pipeline to the cloud? Choose your provider below for detailed, container-optimized instructions:

- [**Amazon Web Services (AWS)**](docs/deployment-aws.md) - Using RDS and App Runner.
- [**Google Cloud (GCP)**](docs/deployment-gcp.md) - Using Cloud Run and Cloud SQL.
- [**Microsoft Azure**](docs/deployment-azure.md) - Using App Service and Flexible Server.
- [**Free & Alternative Platforms**](docs/deployment-free-tiers.md) - Oracle Cloud, Render, Fly.io.

---

## 🔧 Developer Toolbox (`backend/tools/`)

We maintain a suite of specialized tools for deep-dive diagnostics:

| Tool | Purpose |
|------|---------|
| `check_agencies.py` | Validates data coverage across state/national Oris. |
| `migrate_summary.py`| Propagates raw data into high-performance summary tables. |
| `debug_db.py` | Diagnoses connectivity and schema health. |
| `debug_fbi_api.py` | Direct FBI API diagnostic bridge. |

---

## 🤝 Credits & Acknowledgments

- **Data Source**: [FBI Crime Data Explorer (CDE)](https://cde.ucr.cjis.gov/).
- **Engineered by**: The Antigravity Team.
- **Special Thanks**: To our contributors who helped refine the v2.0 architecture and port strategy.

---

> [!NOTE]
> **Looking for Version 1?** You can access the legacy snapshot via the `v1-archive` branch or tag. Version 2.0 is the recommended path for production-intent deployments.
