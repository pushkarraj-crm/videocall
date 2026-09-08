# Load Testing Guide

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/):

```bash
brew install k6   # macOS
```

## Scenarios

```bash
# Smoke test (10 VUs, 30s)
bash scripts/load-test/run-load-test.sh smoke

# 100 concurrent users
bash scripts/load-test/run-load-test.sh 100

# 500 concurrent users
bash scripts/load-test/run-load-test.sh 500

# 1000 concurrent users
bash scripts/load-test/run-load-test.sh 1000
```

## What to Measure

| Metric | Target |
|--------|--------|
| p95 latency | < 500ms (health endpoints) |
| Error rate | < 1% |
| CPU (API) | < 80% sustained |
| Memory | No OOM kills |

## Production Load Test

Run against staging first:

```bash
API_URL=https://api.staging.example.com/v1 bash scripts/load-test/run-load-test.sh 500
```

Monitor with `docker stats` and Sentry during tests.