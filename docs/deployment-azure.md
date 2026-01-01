# Azure Deployment Guide 🟦

Deploying the FBI Crime Data Pipeline to Microsoft Azure.

## Prerequisites
- Azure Subscription
- Azure CLI (az)
- Docker installed

## 1. Web Hosting: Azure App Service (Always Free)
Azure offers an "Always Free" tier for Linux/Windows App Services (F1 Free tier).

1.  **Create App Service**:
    - Choose **Linux** as the OS.
    - Select the **F1 (Free)** Pricing Tier.
    - Set **Docker Hub** or **Azure Container Registry** as the source.

2.  **Config**:
    - Navigate to **Configuration** in the Portal.
    - Add Application Settings for your `.env` variables.

## 2. Database: Azure Database for PostgreSQL
New accounts get 12 months free of a Flexible Server (Burstable B1MS).

1.  Create a **Flexible Server** in the portal.
2.  Select **Development** workload.
3.  Choose **B1ms** instance size.
4.  Enable **Public Access** (limited to your IP) or use VNET integration.

## 3. Redis & Elasticsearch
- **Redis**: Use **Azure Cache for Redis** (Basic tier is low cost, but no persistent free tier).
- **Elasticsearch**: Use the **Elastic Cloud on Azure** integration.

## Deployment Steps
```bash
# Login to Azure
az login

# Create Resource Group
az group create --name fbi-pipeline-rg --location eastus

# Create App Service Plan (Free Tier)
az appservice plan create --name fbi-plan --resource-group fbi-pipeline-rg --sku F1 --is-linux

# Deploy Container
az webapp create --resource-group fbi-pipeline-rg --plan fbi-plan --name fbi-backend-app --deployment-container-image-name your-docker-img
```

## Environment Variables
Map your secrets in the Azure Portal under **Settings > Configuration**:
- `DATABASE_URL`
- `REDIS_URL`
- `ELASTICSEARCH_URL`
