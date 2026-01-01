# AWS Deployment Guide 🚀

Deploying the FBI Crime Data Pipeline to AWS (Amazon Web Services).

## Prerequisites
- AWS Account
- AWS CLI installed and configured
- Docker installed locally

## 1. Database: Amazon RDS (Free Tier Eligible)
Amazon RDS offers 750 hours/month of `db.t3.micro` for 12 months.

1.  Navigate to the **RDS Console**.
2.  Create a **PostgreSQL** database.
3.  Select the **Free Tier** template.
4.  **Instance Class**: `db.t3.micro` or `db.t4g.micro`.
5.  **Storage**: 20GB General Purpose SSD (gp2).
6.  **Public Access**: No (ensure your app can reach it within the VPC).
7.  Note the **Endpoint URI** and **Credentials**.

## 2. Shared Services: Redis & Elasticsearch
- **Redis**: Use **Amazon ElastiCache** (Free tier: 750 hours of `cache.t2.micro`).
- **Elasticsearch**: Use **Amazon OpenSearch Service** (Free tier: 750 hours of `t2.small.search`).

## 3. App Deployment: AWS App Runner
App Runner is the easiest way to deploy containerized web apps on AWS.

1.  **Build and Push**:
    ```bash
    # Login to ECR
    aws ecr get-login-password --region your-region | docker login --username AWS --password-stdin your-account-id.dkr.ecr.your-region.amazonaws.com
    
    # Create Repositories
    aws ecr create-repository --repository-name fbi-backend
    aws ecr create-repository --repository-name fbi-frontend
    
    # Tag and Push
    docker tag fbi-backend:latest your-account-id.dkr.ecr.your-region.amazonaws.com/fbi-backend:latest
    docker push your-account-id.dkr.ecr.your-region.amazonaws.com/fbi-backend:latest
    ```

2.  **Create App Runner Service**:
    - Select the ECR image.
    - Set environment variables for DB, Redis, and ES.
    - **Port**: 8000 for backend, 3000 for frontend.

## Environment Variables Mapping
| Project Var | AWS App Runner Config |
|-------------|-----------------------|
| `DATABASE_URL` | `postgresql://user:pass@rds-endpoint:5432/dbname` |
| `REDIS_URL` | `redis://elasticache-endpoint:6379` |
| `ELASTICSEARCH_URL` | `https://opensearch-endpoint:443` |

## Cost Optimization Tips
- Standardize on `t3.micro` or smaller.
- Use **VPC Endpoints** to avoid NAT Gateway costs.
- Set up **AWS Budgets** to receive alerts if you exceed free tier limits.
