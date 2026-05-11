# Deployment Architecture

## Infrastructure

### AWS Services
- **ECS Fargate**: Container orchestration for microservices
- **RDS PostgreSQL**: Primary database (Multi-AZ deployment)
- **ElastiCache Redis**: Session and cart caching
- **DocumentDB**: MongoDB-compatible audit log storage
- **ALB**: Application Load Balancer for traffic distribution
- **CloudFront**: CDN for static assets

### Kubernetes Configuration

Each service is deployed as a separate Kubernetes deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: checkout-service
  template:
    metadata:
      labels:
        app: checkout-service
    spec:
      containers:
      - name: checkout-service
        image: checkout-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: connection-string
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Service Mesh

Using Istio for service-to-service communication:
- mTLS for secure inter-service communication
- Traffic management and load balancing
- Circuit breaking and retry policies
- Observability and tracing

### Scaling Configuration

**Auto-scaling based on:**
- CPU utilization > 70%
- Memory utilization > 80%
- Request queue depth > 100

**Scaling limits:**
- Min replicas: 2 (for high availability)
- Max replicas: 10 (cost control)

### CI/CD Pipeline

1. **Build**: GitHub Actions builds Docker images
2. **Test**: Run unit and integration tests
3. **Scan**: Trivy security scanning
4. **Deploy to Staging**: Automatic deployment to staging
5. **Integration Tests**: Run E2E tests in staging
6. **Deploy to Production**: Manual approval required
7. **Health Check**: Verify service health post-deployment
8. **Rollback**: Automatic rollback on health check failure

### Environments

- **Development**: Single replica, minimal resources
- **Staging**: Production-like, 2 replicas
- **Production**: Multi-AZ, auto-scaling, 3+ replicas

### Database Migrations

Using Flyway for database migrations:
- Versioned SQL scripts
- Automatic migration on deployment
- Rollback support for failed migrations

### Disaster Recovery

- **RTO**: 1 hour
- **RPO**: 15 minutes
- Daily automated backups
- Cross-region backup replication
- Tested quarterly DR drills
