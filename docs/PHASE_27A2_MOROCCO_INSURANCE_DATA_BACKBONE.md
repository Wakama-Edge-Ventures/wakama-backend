# Phase 27A.2 - Morocco Insurance Data Backbone

Date: 2026-05-29  
Scope: Additive data foundation for Wakama Assurance Maroc backend

## What Was Added

- Additive Prisma backbone models for:
  - Morocco geography references (regions, provinces extensions, communes extensions, cities)
  - Crop/season/agro-climatic references
  - Morocco risk zone references
  - RAX catalogs and parameter sets
  - Claims catalogs and alert thresholds
  - Pricing/tax technical parameter sets
  - NDVI readiness extensions and weather archive seed table
  - Agent profile foundation
  - Evidence file/bundle and blockchain anchor queue foundation
- New GET-only reference routes for Morocco and insurance catalogs.
- Source disclosure helper used in reference responses.
- Evidence/IPFS/Solana safe stubs with async/non-blocking behavior.
- New backbone seed script: `src/seeds/moroccoInsuranceBackbone.ts` (dry-run default).

## Data Source Labels

This phase uses explicit source labels in DB and API responses:
- `LIVE`
- `SEED_DEMO`
- `EXCEL_IMPORT`
- `MANUAL_ESTIMATE`

Manual or demo rows are not official reference data.

## Regulatory and Role Positioning

- Wakama is not an insurer.
- Wakama does not emit policies.
- Wakama does not indemnify.
- Wakama prepares technical evidence, scoring, and monitoring.
- The insurer remains decision maker for eligibility, pricing, policy issuance, and indemnification.

## Evidence Anchoring Model

- IPFS/Pinata and Solana settings are backend-only env values.
- Upload/anchoring can be disabled safely.
- Anchoring is asynchronous and non-blocking.
- Business flows must continue even when anchoring is disabled or pending.

## New Seed Script Commands

- Dry-run (default safe mode):  
  `npx tsx src/seeds/moroccoInsuranceBackbone.ts --dry-run`
- Write mode (manual trigger only):  
  `npx tsx src/seeds/moroccoInsuranceBackbone.ts --write`

## New Reference Endpoints

- `GET /v1/morocco/regions`
- `GET /v1/morocco/provinces`
- `GET /v1/morocco/communes`
- `GET /v1/morocco/cities`
- `GET /v1/morocco/crops`
- `GET /v1/morocco/crop-seasons`
- `GET /v1/morocco/agro-climatic-zones`
- `GET /v1/morocco/risk-zones`
- `GET /v1/morocco/dams`
- `GET /v1/morocco/river-segments`
- `GET /v1/morocco/flood-risk-zones`
- `GET /v1/insurance/references`
- `GET /v1/insurance/references/threats`
- `GET /v1/insurance/references/vulnerabilities`
- `GET /v1/insurance/references/rax-parameters`
- `GET /v1/insurance/references/claim-causes`
- `GET /v1/insurance/references/claim-statuses`
- `GET /v1/insurance/references/alert-thresholds`
- `GET /v1/insurance/references/pricing-parameters`
- `GET /v1/insurance/evidence/health`

## Migration Warning

Schema changed in this phase.  
Database migration must be applied later in a controlled local/staging process before production usage.

Not run in this implementation:
- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db push`
- any reset command

## Follow-up Phase

Phase 27B implements the functional insurance workflow layer (applications, missions, field audit sync, RAX engine, hydro/weather/NDVI services, and evidence bundle routes):  
`docs/PHASE_27B_INSURANCE_ROUTES_RAX_WEATHER_NDVI_HYDRO.md`
