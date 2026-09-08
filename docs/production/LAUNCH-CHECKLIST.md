# Production Launch Checklist

## Infrastructure

- [ ] `.env.production` filled with all secrets
- [ ] `ENABLE_DEV_AUTH=false`
- [ ] Docker images built (`npm run docker:prod:build`)
- [ ] `docker compose -f docker-compose.prod.yml up -d`
- [ ] Migrations applied (`npm run prod:migrate`)
- [ ] SSL certificates issued (`init-letsencrypt.sh`)
- [ ] HTTPS redirect working
- [ ] NGINX rate limiting active
- [ ] Backup profile enabled (`--profile backup`)
- [ ] Redis connected (`/v1/health/ready` shows redis: ok)
- [ ] Worker container running cron jobs
- [ ] Sentry DSN configured (optional)

## Security

- [ ] JWT_SECRET ≥ 64 random characters
- [ ] Internal API keys rotated from dev defaults
- [ ] CORS_ORIGINS set to production domain only
- [ ] Security headers verified (securityheaders.com)
- [ ] Razorpay webhook secret configured
- [ ] Firebase production credentials

## Verification

- [ ] `npm run prod:verify` passes
- [ ] Load test 100 VUs passes
- [ ] Manual smoke: login, discover, wallet, call
- [ ] Admin panel accessible
- [ ] Risk dashboard accessible

## Regression (must all pass)

- [ ] Authentication unchanged
- [ ] Calling (audio/video) unchanged
- [ ] Wallet & Razorpay unchanged
- [ ] Referrals & Promos unchanged
- [ ] Notifications & Communications unchanged
- [ ] KYC, Withdrawals, Reviews, Reports unchanged
- [ ] Anti-Fraud Engine unchanged