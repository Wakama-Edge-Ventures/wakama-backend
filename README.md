# Wakama Backend

Fastify + Prisma backend for Wakama platform services (farmers, cooperatives, scoring, weather, IoT, and institutional modules).

## Phase 27A (Morocco Foundation)

Phase 27A backend foundation is now additive in code and schema with:
- `FIELD_AGENT` role support in Prisma enum.
- CNDP-ready farmer fields (`cndpConsent`, consent timestamp/version, Morocco identity fields).
- PII masking helpers for phone/CIN/email exposure control.
- Morocco reference read routes:
  - `GET /v1/morocco/provinces`
  - `GET /v1/morocco/communes?provinceId=...`
  - `GET /v1/morocco/dams`
  - `GET /v1/morocco/flood-risk-zones`
  - `GET /v1/morocco/crop-categories`
- Morocco reference seed script: `src/seeds/moroccoReferences.ts`.
- Country-aware weather timezone selection (`MA` uses `MOROCCO_TIMEZONE`, CI remains default behavior).

## Important Safety Note

Do not create real Morocco farmer records before applying the Phase 27A database migration/schema update in local/staging and validating farmer route protections.
