# GCP Deployment Guide ☁️

Deploying the FBI Crime Data Pipeline to Google Cloud Platform.

## Prerequisites
- Google Cloud Project
- gcloud CLI installed
- Artifact Registry enabled

## 1. Container Engine: Cloud Run (Generous Free Tier)
Cloud Run is highly cost-efficient due to its "scale to zero" capability.

1.  **Build and Push**:
    ```bash
    # Enable Artifact Registry
    gcloud artifacts repositories create fbi-repo --repository-format=docker --location=us-central1
    
    # Authenticate Docker
    gcloud auth configure-docker us-central1-docker.pkg.dev
    
    # Push Backend
    docker tag fbi-backend us-central1-docker.pkg.dev/your-project/fbi-repo/backend
    docker push us-central1-docker.pkg.dev/your-project/fbi-repo/backend
    ```

2.  **Deploy**:
    ```bash
    gcloud run deploy fbi-backend --image us-central1-docker.pkg.dev/your-project/fbi-repo/backend --platform managed
    ```

## 2. Database: Cloud SQL
Cloud SQL for PostgreSQL is a robust managed service.

1.  Create a Cloud SQL instance.
2.  Enable the **Cloud SQL Auth Proxy** for secure connections.
3.  Set the connection string in your environment variables.

## 3. Redis & Elasticsearch
- **Redis**: Use **Memorystore** for Redis.
- **Elasticsearch**: Use **Elastic Cloud on GCP** or host a container on GCE.

## Always Free Tier Limits (Cloud Run)
Google Cloud provides a robust "Always Free" allowance for Cloud Run:
- 2 million requests per month.
- 180,000 vCPU-seconds per month.
- 360,000 GiB-seconds per month.

## Environment Variables
Ensure `NEXT_PUBLIC_API_URL` is set correctly during the frontend build process or at runtime if using a SSR-friendly configuration.

```bash
gcloud run services update fbi-frontend \
  --set-env-vars NEXT_PUBLIC_API_URL=https://backend-url.a.run.app
```
