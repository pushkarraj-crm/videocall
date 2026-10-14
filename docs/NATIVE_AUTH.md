# PostgreSQL authentication

The API owns email/password and phone authentication. Google sign-in talks
directly to Google OAuth; neither app uses Firebase. Existing user IDs, roles,
wallets, and profiles are preserved. The database column `users.firebase_uid`
is retained only as a legacy identity key, exposed internally as `authIdentity`.
It is not used to call Firebase or validate credentials.

## Local development

Run `npm run setup` and `npm run dev` from the monorepo root. Passwords must
contain 12–128 characters. New accounts receive only the user role and still
complete the existing onboarding flow. Host/admin permissions come from stored
roles, never a registration request.

Without SMTP, development verification/recovery emails are saved privately in
`apps/api/.local/auth-mail/*.json`. With `SMS_PROVIDER=console`, development OTP
messages are saved in `apps/api/.local/auth-sms/<challengeId>.json`. These files
are ignored by Git and never served over HTTP. Production refuses local delivery.

## Google login

Create a **Web application** OAuth client in Google Cloud Console. Configure
the consent screen and add test users if the app is in testing mode. Add this
authorized redirect URI exactly:

`http://localhost:3001/v1/auth/google/callback`

Put these in `apps/api/.env`, and restart the API:

```dotenv
WEB_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/v1/auth/google/callback
```

For deployment, use the public HTTPS API callback and public web origin. Client
secrets stay on the backend. OAuth uses signed HttpOnly state cookies, PKCE,
nonce validation, and Google's token signature/audience verification. The
browser receives a single-use, 60-second exchange code, never JWTs in a URL.
Keep API and web on the same site so the OAuth callback cookie is sent.

Existing unique legacy email accounts are linked after Google verifies ownership.
Native password accounts must first verify their email or reset their password
before Google can link them. Ambiguous duplicate legacy emails require support.

Reference: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## MSG91 phone OTP

This integration uses **MSG91 SMS Flow** to deliver a code generated and verified
by the backend. Purchase/enable SMS delivery and create an approved Flow template
with an OTP variable. Configure the sender/DLT template in the MSG91 dashboard.
The configured message must identify Lovenexa and match your approved template.

```dotenv
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=your-private-auth-key
MSG91_OTP_TEMPLATE_ID=your-SMS-Flow-template-id
MSG91_OTP_VARIABLE=OTP
```

`MSG91_OTP_VARIABLE` must exactly match the variable name on your Flow template.
The template ID is the **SMS Flow template ID**, not an OTP Widget ID or a raw
DLT template ID. No MSG91 key goes into frontend environment variables.

Codes expire after five minutes, permit at most five attempts, and can be used
once. Sends are limited to one per minute and five per hour per phone, plus IP
rate limits. A resend invalidates earlier codes. Codes are stored as keyed HMAC
hashes. Provider failures invalidate the challenge; there is no silent fallback
to local delivery when MSG91 is selected.

Unique legacy phone-only accounts are preserved by the migration. Phone fields
on email profiles are not automatically linked because they may be unverified.

Reference: [MSG91 SMS Flow API](https://docs.msg91.com/sms/send-sms).

## Password recovery and email verification

Existing Firebase email users must use **Forgot password** to establish a local
password. Their old Firebase password is not copied. Only accounts already
present in PostgreSQL can be recovered. If an account existed only in Firebase,
sign in with Google or create a new local account.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` for
real email delivery. SMTP and EMAIL_FROM are required in production. Recovery
responses do not reveal whether an email exists. Recovery tokens are random,
hashed in PostgreSQL, expire in 30 minutes, and are consumed atomically. Resetting
a password revokes existing access and refresh sessions. Passwords use salted
scrypt; credentials are separate from profile records and are never returned by
profile endpoints.

## Migration and checks

Deploy `20261005_postgres_auth` and `20261006_auth_legacy_phone_identities` with
the normal Prisma migration process. They add
credential, recovery, Google identity, phone identity, and OTP challenge tables,
and widens phone storage to 16 characters. Do not reset the existing database.
The repaired local database has this migration applied and a pre-change backup
in `apps/api/.local/backups/pre-native-auth.dump`.

```bash
npm test -w @platform/api -- --runInBand password.spec.ts google-auth.controller.spec.ts msg91-sms.provider.spec.ts
cd apps/api
npx tsx scripts/verify-native-auth.ts
```

The end-to-end check runs only with local SMTP/SMS delivery, cleans up its own
fixtures, and does not print passwords or tokens. Live Google/MSG91 delivery must
be tested after supplying real provider credentials.
