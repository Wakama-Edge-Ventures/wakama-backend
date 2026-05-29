# Phase 27D.2 - Assurance Pilot Admin Account

This seed creates one internal pilot institution account for backend authentication testing:

- Institution: `Wakama Assurance Maroc Pilot`
- Admin login: `assurance-admin@wakama.farm`
- Endpoint target: `POST /v1/auth/institution-login`

Important scope:

- This is a pilot/admin account for internal Wakama testing.
- This is not fake farmer data and not a fake insurance client record.
- The script does not create farmers, cooperatives, parcelles, insurance applications, missions, policies, or claims.

Credential handling:

- Password source: `SEED_ASSURANCE_ADMIN_PASSWORD`.
- Local development fallback: `WakamaAssurance@2026` only when not in production.
- Credentials must be rotated before production partner demos.

