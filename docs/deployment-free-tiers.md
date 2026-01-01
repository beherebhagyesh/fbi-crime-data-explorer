# Free Tier & Alternative Platforms 🚀

Guide for deploying the FBI Crime Data Pipeline on specialized developer platforms with generous free tiers.

## 1. Render (Highly Recommended)
Render is developer-friendly and offers an excellent free tier for web services and PostgreSQL.

- **Web Service (Frontend/Backend)**: Free instance type with automatic deployments from GitHub.
- **PostgreSQL**: Free tier available (valid for 90 days, then $7/mo).
- **Redis**: Low-cost managed Redis available.

**Deployment Tip**: Use a `render.yaml` (Blueprint) to orchestrate the entire stack.

## 2. Oracle Cloud (The "Hidden Gem")
Oracle offers the most generous "Always Free" VPS resources in the industry.

- **4 ARM Ampere A1 Compute instances** with 24 GB of RAM (shared).
- **2 AMD Compute instances**.
- **Autonomous Database** (20 GB storage).

**Strategy**: Deploy a single large ARM instance and run the **entire Docker Compose stack** directly on the VPS. This is the only way to get ES, Redis, Postgres, and the app all for $0/mo.

## 3. Fly.io
Fly.io runs your containers "close to users" and has a flexible free allowance.

- **Allowance**: $5/mo credit (covers roughly 3 small VMs).
- **Postgres**: Fly has a specialized Postgres cluster management tool.

## 4. Railway
Railway has moved to a trial model, but it is one of the fastest ways to deploy.
- **Trial**: $5 one-time credit (no expiration).
- **Auto-Infrastructure**: Simply drag-and-drop your Docker Compose.

---

## Technical Considerations for Free Tiers
- **Port Mapping**: Ensure your cloud load balancer maps External 443/80 to Internal 3000/8000.
- **Cold Starts**: Services like Render and Cloud Run may experience "cold starts" where the first request after idle takes longer.
- **Data Retention**: Check if your free database has an expiration date (like Render's 90-day DB).
