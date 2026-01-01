# Rebuild and Deploy Instructions

This directory contains Kubernetes manifests for running the FBI County Scraper stack on a K8s cluster.

## Deployment with kubectl

1. **Build the images** (if not using pre-built ones):
   ```bash
   docker build -t fbi-backend:latest ./backend
   docker build -t fbi-frontend:latest ./frontend
   ```

2. **Apply manifests**:
   ```bash
   kubectl apply -f postgres.yaml
   kubectl apply -f redis.yaml
   kubectl apply -f elasticsearch.yaml
   kubectl apply -f backend.yaml
   kubectl apply -f frontend.yaml
   ```

3. **Access the Application**:
   The frontend is exposed via a `NodePort` on port `32000`. You can access it at `http://localhost:32000`.
   If you want to use port `49000`, you can use port-forwarding:
   ```bash
   kubectl port-forward service/frontend 49000:3000
   ```
