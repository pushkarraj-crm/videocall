import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.API_URL || 'http://localhost:3001/v1';
const VUS = Number(__ENV.VUS || 100);
const DURATION = __ENV.DURATION || '2m';

const latency = new Trend('custom_latency', true);
const errorRate = new Rate('custom_errors');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    custom_errors: ['rate<0.05'],
  },
};

export default function () {
  const paths = ['/health', '/health/live', '/health/ready', '/legal/policies'];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${BASE}${path}`);
  latency.add(res.timings.duration);
  const ok = check(res, { 'status 200': (r) => r.status === 200 });
  errorRate.add(!ok);
  sleep(0.3 + Math.random() * 0.7);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  return {
    stdout: JSON.stringify(
      {
        scenario: `${VUS} VUs / ${DURATION}`,
        vus: VUS,
        duration: DURATION,
        latencyP95Ms: Math.round(p95),
        errorRate: failed,
        httpReqs: data.metrics.http_reqs?.values?.count ?? 0,
        passed: failed < 0.05 && p95 < 2000,
      },
      null,
      2,
    ),
    'scripts/load-test/results.json': JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        vus: VUS,
        duration: DURATION,
        latencyP95Ms: Math.round(p95),
        errorRate: failed,
        passed: failed < 0.05 && p95 < 2000,
      },
      null,
      2,
    ),
  };
}