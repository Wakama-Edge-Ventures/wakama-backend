# Phase 27B - Insurance Routes + RAX + Weather Archive + NDVI + Hydro Risk

Date: 2026-05-29  
Scope: Functional backend insurance workflow layer for Morocco-first MVP

## Implemented Routes

All new routes are registered in `src/index.ts` via:
- `app.register(insuranceRoutes, { prefix: '/v1/insurance' })`

### Applications
- `POST /v1/insurance/applications`
- `GET /v1/insurance/applications`
- `GET /v1/insurance/applications/:id`
- `POST /v1/insurance/applications/:id/submit`
- `GET /v1/insurance/applications/:id/technical-summary`
- `GET /v1/insurance/applications/:id/rax`
- `POST /v1/insurance/applications/:id/evidence-bundle`

### Missions
- `POST /v1/insurance/missions`
- `GET /v1/insurance/missions`
- `GET /v1/insurance/missions/:id`
- `POST /v1/insurance/missions/:id/assign`
- `POST /v1/insurance/missions/:id/status`

### Field Audit
- `POST /v1/insurance/field-audit/sync`

### RAX
- `POST /v1/insurance/rax/calculate`

### Hydro Risk
- `GET /v1/insurance/hydro-risk?lat=&lng=&radiusKm=`

### Weather Archive
- `GET /v1/insurance/weather/archive?lat=&lng=&startDate=&endDate=`

### NDVI History
- `GET /v1/insurance/ndvi/history?parcelleId=`
- `GET /v1/insurance/ndvi/history?lat=&lng=&startDate=&endDate=`

### Evidence
- `POST /v1/insurance/evidence/bundle`
- `GET /v1/insurance/evidence/health`

## Service Modules Added

- `src/lib/insurance/raxEngine.ts`
- `src/lib/insurance/hydroRisk.ts`
- `src/lib/insurance/weatherArchive.ts`
- `src/lib/insurance/ndviHistory.ts`
- `src/lib/insurance/insuranceWorkflow.ts`
- `src/lib/insurance/insuranceEvidence.ts`
- `src/lib/insurance/insuranceValidation.ts`

## RAX Formula and Output

RAX engine uses:
- `RAX_BRUT = G * F * D`
- `WRS = (RAX_BRUT / 25) * 100`

Scores use `1..5` scale for:
- `gravityScore`
- `frequencyScore`
- `detectionScore`

Technical risk tiers:
- `0..20 => LOW_RISK`
- `21..50 => MEDIUM_RISK`
- `51..75 => HIGH_RISK`
- `76..100 => UNINSURABLE`

Response includes:
- `riskTier`
- `technicalRiskTier`
- `algorithmVersion = RAX_V1_MA_2026`
- `explanationFactors[]`
- `warnings[]`
- `sourceDisclosure`

No route returns insurer approval/rejection. Wakama returns technical risk structuring only.

## Hydro Risk Assumptions

Hydro risk combines rule-based technical signals:
- nearest Morocco dam distance
- nearest Morocco river segment distance
- flood zone proximity (from flood geometry centroid where available)
- Morocco risk zone radius overlap (`riskType=FLOOD`)
- optional rainfall anomaly and elevation weighting

Output includes:
- `hydroRiskLevel: LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN`
- `nearestDam`
- `nearestRiver`
- `floodZoneMatches[]`
- `reasons[]`
- `confidence`
- `warnings[]`
- `sourceDisclosure`

Important: proximity alone is not a sinistre decision and not eligibility approval/rejection.

## Weather Archive Behavior

`getWeatherArchiveForPoint(...)` behavior:
- validates lat/lng/date range
- checks `WeatherHistorySeed` cache first
- fetches Open-Meteo archive for missing days if `allowLiveFetch=true`
- stores live daily rows in `WeatherHistorySeed`
- returns safe degraded output if provider unavailable

Daily output fields:
- `date`
- `tempMax`
- `tempMin`
- `precipitation`
- `weatherCode`
- `provider`
- `source`
- `confidence`

Statuses:
- `OK`
- `DEGRADED`
- `UNAVAILABLE`

## NDVI History Behavior

NDVI history reads only from `NdviHistory` table.

No fake live Copernicus rows are generated.

If no rows:
- `status=UNAVAILABLE`
- `source=UNAVAILABLE`
- `provider=COPERNICUS_PENDING`
- warning: `NDVI history not available yet for this parcel/point`

Trend output:
- `avgNdvi`
- `minNdvi`
- `maxNdvi`
- `latestNdvi`
- `dropPercent`
- `anomalyLevel: NONE|WATCH|WARNING|CRITICAL|UNKNOWN`

## Evidence Bundle Behavior

Evidence functions:
- canonicalize payload
- compute stable hash
- create `EvidenceBundle` with `READY_TO_ANCHOR`
- enqueue `AnchorQueue` with `PENDING`
- never block business workflow when Pinata/Solana are disabled

Anchor mode remains optional, async, and best-effort.

## Source Disclosure Rules

New routes return `sourceDisclosure` and disclaimers in French + English.

Disclosures explicitly state:
- Wakama provides technical risk structuring/evidence integrity
- insurer is sole decision-maker for eligibility/pricing/issuance/indemnification
- sources can be `LIVE`, `SEED_DEMO`, `EXCEL_IMPORT`, `MANUAL_ESTIMATE`
- blockchain/IPFS is integrity timestamping, not legal/regulatory decision

## Degraded Modes Implemented

- Weather provider unavailable:
  - return `status=DEGRADED` or `UNAVAILABLE`
  - attach warning(s)
  - no RAX crash
- NDVI unavailable:
  - return `status=UNAVAILABLE`
  - no fake live values
  - warning included
- Hydro references incomplete:
  - confidence lowered (`LOW`/`MEDIUM`)
  - warning included
- Pinata disabled:
  - health route returns disabled-safe mode
  - no throw in evidence flows
- Solana disabled:
  - anchoring status returns disabled-safe
  - queue remains non-blocking

## Insurer Decision Boundary

Wakama does not issue policies and does not indemnify.

Wakama prepares, scores, monitors, timestamps, and anchors technical evidence.

Insurer remains sole decision-maker for:
- eligibility
- pricing
- policy issuance
- indemnification

## Local Test Commands

Prerequisites:
- backend running (for example `npm run dev`)
- valid bearer token with role in: `SUPERADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, or `FIELD_AGENT`

Set token:

```bash
export TOKEN="<jwt_here>"
```

Create technical pre-application (no farmer link, non-persisted):

```bash
curl -X POST "http://localhost:4000/v1/insurance/applications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "country":"MA",
    "cropCode":"BLE_DUR",
    "lat":34.9417,
    "lng":-5.8394,
    "surfaceHa":3.2,
    "source":"MANUAL_ENTRY"
  }'
```

Create persisted application (requires existing `farmerId`):

```bash
curl -X POST "http://localhost:4000/v1/insurance/applications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "country":"MA",
    "farmerId":"<existing_farmer_id>",
    "cropCode":"OLIVIER",
    "lat":34.94,
    "lng":-5.84,
    "surfaceHa":5,
    "source":"LIVE"
  }'
```

Create mission:

```bash
curl -X POST "http://localhost:4000/v1/insurance/missions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId":"<application_id>",
    "missionType":"FIELD_AUDIT",
    "notes":"Pilot mission"
  }'
```

Sync field audit:

```bash
curl -X POST "http://localhost:4000/v1/insurance/field-audit/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "missionId":"<mission_id>",
    "applicationId":"<application_id>",
    "agentUserId":"<agent_user_id>",
    "capturedAt":"2026-05-29T10:00:00.000Z",
    "lat":34.9417,
    "lng":-5.8394,
    "answersJson":{"cropState":"ok"},
    "photos":[],
    "source":"LIVE"
  }'
```

Calculate RAX:

```bash
curl -X POST "http://localhost:4000/v1/insurance/rax/calculate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId":"<application_id>",
    "country":"MA",
    "cropCode":"BLE_DUR",
    "lat":34.9417,
    "lng":-5.8394,
    "useHydroRisk":true,
    "useWeatherArchive":true,
    "useNdviHistory":true,
    "startDate":"2026-05-01",
    "endDate":"2026-05-29"
  }'
```

Hydro risk:

```bash
curl -X GET "http://localhost:4000/v1/insurance/hydro-risk?lat=34.9417&lng=-5.8394&radiusKm=25" \
  -H "Authorization: Bearer $TOKEN"
```

Weather archive:

```bash
curl -X GET "http://localhost:4000/v1/insurance/weather/archive?lat=34.9417&lng=-5.8394&startDate=2026-05-01&endDate=2026-05-10" \
  -H "Authorization: Bearer $TOKEN"
```

NDVI by point:

```bash
curl -X GET "http://localhost:4000/v1/insurance/ndvi/history?lat=34.9417&lng=-5.8394&startDate=2026-01-01&endDate=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

Evidence health:

```bash
curl -X GET "http://localhost:4000/v1/insurance/evidence/health" \
  -H "Authorization: Bearer $TOKEN"
```

## Migration Warning

No Prisma schema change was made in this phase implementation.

Result:
- No new migration is required specifically for Phase 27B code changes.
- Existing Phase 27A/27A.2 schema remains the baseline.

Not run in this implementation:
- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db push`
- any DB reset
