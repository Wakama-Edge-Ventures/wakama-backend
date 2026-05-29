# Phase 27A Implementation Notes

Date: 2026-05-29
Scope: Backend safety + Morocco schema foundation (additive only)

## Safety Commitments
- Additive-only backend and schema changes.
- No destructive database operations.
- No table drops, no table renames, no resets.
- No automatic execution of `prisma migrate dev` or `prisma db push` in this implementation.
- Existing CI/UEMOA behavior must remain compatible.

## Planned Changes
- Additive Prisma updates:
  - `FIELD_AGENT` role.
  - Morocco-ready fields on `Farmer`, `Parcelle`, `Cooperative`, `WeatherHistory`.
  - New models for NDVI history, Morocco references, insurance foundation, crop categories, and audit logs.
- Route/security updates:
  - Farmer endpoint masking and safer access behavior.
  - CNDP consent enforcement for Morocco (`country = MA`) create/update flows.
  - Morocco-specific CIN and phone validation.
  - Additive CORS origins for Morocco apps and dashboards.
- Runtime helper updates:
  - New PII masking helper (`src/lib/pii.ts`).
  - Timezone helper for country-aware weather collection.
- New additive modules:
  - Morocco reference seed script.
  - Read-only Morocco reference routes.

## Implemented Changes

### Prisma Schema (Additive)
- Role enum:
  - Added `FIELD_AGENT` (existing roles preserved).
- `Farmer`:
  - Added `country`, `cin`, `province`, `commune`, `cndpConsent`, `cndpConsentAt`, `cndpConsentVersion`, `dateNaissance`, `sexe`, `moroccoPhoneNormalized`.
- `Parcelle`:
  - Added `country`, `province`, `commune`, `regionCode`, `elevationM`, `slopePct`, `hydroRiskLevel`, `hydroRiskScore`, `hydroRiskJson`.
- `Cooperative`:
  - Added `country`, `province`, `commune`, `iceOrRc`.
- `WeatherHistory`:
  - Added `source`, `provider`, `regionCode`.
- New models:
  - `NdviHistory`
  - `MoroccoProvince`
  - `MoroccoCommune`
  - `MoroccoDam`
  - `MoroccoRiverSegment`
  - `MoroccoFloodRiskZone`
  - `InsuranceCropCategory`
  - `AuditLog`
  - `InsuranceApplication`
  - `InsuranceMission`
  - `InsuranceFieldAudit`

### Route/Security Changes
- `src/middleware/auth.ts`
  - `optionalAuth` now degrades invalid tokens to anonymous context instead of returning 401.
- `src/routes/farmers.ts`
  - `GET /v1/farmers/:id` now uses optional auth and returns public-minimal profile when unauthenticated.
  - Sensitive fields (`cniUrl`, `attestationUrl`, raw phone/CIN, `moroccoPhoneNormalized`) are masked/hidden for non-authorized contexts.
  - `GET /v1/farmers` keeps compatibility shape but masks sensitive fields by default.
  - `POST /v1/farmers` now protected by token + role guard; `/v1/auth/register` remains public path for farmer self-registration flow.
  - CNDP consent enforcement for Morocco (`country=MA`) on create/update.
  - Morocco phone/CIN validation for MA records only.
- `src/lib/security.ts`
  - Added Morocco dashboard/app CORS origins additively.
- `src/jobs/weatherCollector.ts`
  - Added `getTimezoneForCountry(country)` helper.
  - Removed hardcoded single-country timezone behavior.
  - Defaults legacy/unknown country to CI behavior.
- `src/routes/morocco.ts`
  - Added read-only Morocco reference endpoints:
    - `GET /v1/morocco/provinces`
    - `GET /v1/morocco/communes?provinceId=...`
    - `GET /v1/morocco/dams`
    - `GET /v1/morocco/flood-risk-zones`
    - `GET /v1/morocco/crop-categories`

### New Utility
- `src/lib/pii.ts`
  - `maskMoroccoCin`
  - `maskMoroccoPhone`
  - `maskEmail`
  - `canViewSensitivePii`

### Seed Additions
- Added `src/seeds/moroccoReferences.ts` (not auto-run).
- Idempotent upserts for pilot references:
  - Province: Larache (region Tanger-Tétouan-Al Hoceïma)
  - Commune: Ksar El-Kébir
  - Dam: Oued El Makhazine (Loukkos basin)
  - River segment: Loukkos / Oued Loukkos pilot segment
  - Flood zone: Ksar El-Kébir Loukkos plain pilot zone
  - Insurance crop categories (MA):
    - `BLE_DUR`, `BLE_TENDRE`, `ORGE`, `MAIS`, `OLIVIER`, `AGRUMES`, `MARAICHAGE`, `LEGUMINEUSES`
- Manual/estimated provenance is explicitly marked.

## Manual DB Action Warning
Schema updates require a manual migration/deploy step in local/staging before use in production data paths. No migration or db push was executed in this implementation.

## Commands Run
1. `git status --short`
2. `git config --global --add safe.directory '//wsl.localhost/UbuntuWakama/home/wakama/dev/wakama-backend'`
3. Repository inspection commands (`ls`, `rg --files`, `sed`, `cat`)
4. `npx prisma generate`
5. `npm run build`
6. `npm run lint --if-present`
7. `npm test --if-present`

## Manual Commands Not Run
- `npx prisma migrate dev`
- `npx prisma db push`
- `npx prisma migrate deploy`
- Any production migration command

## Pending Manual DB Actions (Not Executed Here)
Use local/staging only:

1. Local schema migration creation/apply:
   - `npx prisma migrate dev --name phase_27a_backend_safety_morocco_foundation`
2. Staging migration apply:
   - `npx prisma migrate deploy`
3. Regenerate client after migration (if needed in deployment step):
   - `npx prisma generate`

## Env Vars To Add
- `MOROCCO_TIMEZONE=Africa/Casablanca`
- Optional explicit legacy fallback:
  - `CI_TIMEZONE=Africa/Abidjan`
  - `DEFAULT_COUNTRY=CI`
- Additive CORS (if not hardcoded override only):
  - `CORS_ALLOWED_ORIGINS` may include Morocco dashboard/app origins.

## Remaining Risks / Limits
- No full insurance workflow logic yet (expected for Phase 27B).
- `canViewSensitivePii` currently keeps `INSTITUTION_ADMIN` and `FIELD_AGENT` sensitive PII access conservative (default false unless explicit future context/override logic exists).
- Reference geospatial values are marked manual estimates; official hydrology datasets still pending.

## Next Phase Recommendation
- Phase 27B should add mission assignment policy enforcement, insured workflow statuses, pricing/claims settings versioning, stronger audit logging writes, and role-aware field-agent access policies.

---

## Addendum - Phase 27A.2 (2026-05-29)

### Additive Scope

- Added Morocco insurance data backbone schema (geography, crop/season, agro-climatic, risk, RAX catalogs, claims catalogs, pricing/tax parameter sets, weather seed readiness, agent profile, evidence/IPFS/Solana anchor foundation).
- Added new read-only reference APIs under:
  - `/v1/morocco/*`
  - `/v1/insurance/references*`
- Added evidence service stubs with safe disabled behavior:
  - Pinata upload status helper
  - Solana anchoring status helper
  - Anchor queue preparation helper
- Added source disclosure helper for transparent data provenance in responses.
- Added dry-run-first seed script:
  - `src/seeds/moroccoInsuranceBackbone.ts`

### Data Provenance Labels

- `LIVE`
- `SEED_DEMO`
- `EXCEL_IMPORT`
- `MANUAL_ESTIMATE`

No manual or imported seed data is marked as `OFFICIAL`.

### Env Placeholders Added

In `.env.example`:
- `PINATA_JWT`
- `PINATA_GATEWAY_URL`
- `IPFS_GATEWAY_URL`
- `SOLANA_WALLET_PRIVATE_KEY`
- `SOLANA_CLUSTER`
- `SOLANA_RPC_URL`
- `ANCHORING_ENABLED`
- `PINATA_UPLOAD_ENABLED`

### Controlled Migration Warning

Schema changed in Phase 27A.2 and requires controlled local/staging migration before production usage.

Not executed in this phase:
- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db push`
- any DB reset
