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

## Phase 27A.1 (Morocco Dams Excel Import)

- Excel import script: `src/seeds/importMoroccoDamsFromExcel.ts`
  - Dry-run: `npx tsx src/seeds/importMoroccoDamsFromExcel.ts --dry-run`
  - Write: `npx tsx src/seeds/importMoroccoDamsFromExcel.ts --write`
- Data source is imported reference (`EXCEL_IMPORT`) and not treated as official.
- Review artifacts:
  - `docs/MOROCCO_DAMS_IMPORT_REVIEW.md`
  - `data/morocco/morocco-dams-imported-preview.json`
  - `data/morocco/morocco-dams-missing-coordinates.json`
  - `data/morocco/morocco-dams-invalid-rows.json`

## Phase 27A.2 (Insurance Backbone Foundation)

Added additive data backbone for Morocco insurance MVP preparation:
- Morocco geography/crop/season/agro-climatic/risk reference models.
- Insurance reference catalogs (threats, vulnerabilities, claim causes/statuses, alert thresholds, pricing/tax parameter sets).
- RAX foundation models and parameter sets (technical).
- Agent profile foundation.
- Evidence/IPFS/Solana anchoring foundation tables and safe non-blocking service stubs.

New reference routes (GET only):
- `/v1/morocco/regions`
- `/v1/morocco/provinces`
- `/v1/morocco/communes`
- `/v1/morocco/cities`
- `/v1/morocco/crops`
- `/v1/morocco/crop-seasons`
- `/v1/morocco/agro-climatic-zones`
- `/v1/morocco/risk-zones`
- `/v1/morocco/dams`
- `/v1/morocco/river-segments`
- `/v1/morocco/flood-risk-zones`
- `/v1/insurance/references`
- `/v1/insurance/references/threats`
- `/v1/insurance/references/vulnerabilities`
- `/v1/insurance/references/rax-parameters`
- `/v1/insurance/references/claim-causes`
- `/v1/insurance/references/claim-statuses`
- `/v1/insurance/references/alert-thresholds`
- `/v1/insurance/references/pricing-parameters`
- `/v1/insurance/evidence/health`

Backbone seed script (dry-run by default):
- Dry-run: `npx tsx src/seeds/moroccoInsuranceBackbone.ts --dry-run`
- Write: `npx tsx src/seeds/moroccoInsuranceBackbone.ts --write`

Important:
- Wakama is not an insurer and does not issue policies or indemnify.
- Insurer remains the decision maker on eligibility, pricing, issuance, and indemnification.
- Do not create real Morocco farmers before applying DB migration/schema changes and validating routes.

## Phase 27B (Insurance Workflow + RAX + Hydro/Weather/NDVI + Evidence Bundles)

Implemented backend workflow layer under `/v1/insurance`:
- Insurance applications (draft/list/detail/submit + technical summary).
- Mission creation, assignment, status tracking.
- Field audit sync with canonical hash comparison and mismatch handling.
- RAX technical scoring engine (`RAX_BRUT = G * F * D`, `WRS = (RAX_BRUT/25)*100`) with technical tier outputs only.
- Hydro risk helper using Morocco dams/rivers/flood/risk-zone references.
- Open-Meteo historical archive cache/fetch service with safe degraded mode.
- NDVI history service foundation from `NdviHistory` table with explicit unavailable mode.
- Evidence bundle generation + anchor queue (non-blocking async mode).

New service modules:
- `src/lib/insurance/raxEngine.ts`
- `src/lib/insurance/hydroRisk.ts`
- `src/lib/insurance/weatherArchive.ts`
- `src/lib/insurance/ndviHistory.ts`
- `src/lib/insurance/insuranceWorkflow.ts`
- `src/lib/insurance/insuranceEvidence.ts`
- `src/lib/insurance/insuranceValidation.ts`

New route module:
- `src/routes/insurance.ts` (registered with prefix `/v1/insurance`)

Detailed phase doc:
- `docs/PHASE_27B_INSURANCE_ROUTES_RAX_WEATHER_NDVI_HYDRO.md`
