# BACKEND MOROCCO INSURANCE READINESS AUDIT
> Phase 26.5 — Pre-Phase-27 Audit  
> Audit date: 2026-05-29  
> Auditor: Claude Sonnet 4.6 (read-only, no schema or code changes made)  
> Repo: `wakama-backend` — `https://api.wakama.farm`

---

## Table of Contents

1. [Backend Architecture](#section-1--backend-architecture)
2. [Current Data Model Inventory](#section-2--current-data-model-inventory)
3. [Current API Endpoint Inventory](#section-3--current-api-endpoint-inventory)
4. [Security / PII / CNDP Readiness](#section-4--security--pii--cndp-readiness)
5. [Morocco Readiness](#section-5--morocco-readiness)
6. [Weather Archive Readiness](#section-6--weather-archive-readiness)
7. [NDVI / Copernicus Readiness](#section-7--ndvi--copernicus-readiness)
8. [Hydro / Flood Risk Readiness](#section-8--hydro--flood-risk-readiness)
9. [Insurance Workflow Readiness](#section-9--insurance-workflow-readiness)
10. [Agent App Readiness](#section-10--agent-app-readiness)
11. [Farmer App Assurance Readiness](#section-11--farmer-app-assurance-readiness)
12. [Dashboard Readiness](#section-12--dashboard-readiness)
13. [Migration and Deployment Risk](#section-13--migration-and-deployment-risk)
14. [Recommended Phase 27 Implementation Plan](#section-14--recommended-phase-27-implementation-plan)
15. [Final Audit Verdict](#section-15--final-audit-verdict)

---

## SECTION 1 — Backend Architecture

### Runtime / Framework

| Component | Technology | Version | Notes |
|-----------|-----------|---------|-------|
| Language | TypeScript | 5.9.x | `strict: false` — missing type safety |
| Module system | ESM (`"type": "module"`) | — | Requires `.js` imports everywhere |
| Runtime | Node.js | ESM via ts-node/esm | Dev: nodemon + ts-node/esm |
| HTTP Framework | **Fastify** | 5.8.x | Modern, production-grade |
| ORM | **Prisma** | 5.22.x | Custom output path |
| Database | PostgreSQL | — | Via `pg` driver |
| Auth | `@fastify/jwt` + `bcryptjs` | — | JWT RS256-compatible |
| Upload | `@fastify/multipart` + `@fastify/static` | — | Local disk only |
| Email | `nodemailer` | 8.x | Used for onboarding + IoT kit notifications |
| Rate limiting | Custom in-memory (hand-rolled) | — | **No `@fastify/rate-limit`** |

### Entrypoint

`src/index.ts` — bootstraps Fastify, registers plugins, registers routes, sets up two `setInterval` background jobs.

### Route Registration

All routes are flat-registered at the top level of `src/index.ts`. No sub-router grouping. Only `farmersRoutes` uses a `prefix: '/v1/farmers'`. All other route files define their own full paths internally (`/v1/cooperatives`, `/v1/parcelles`, etc.).

**Architecture risk:** Route prefixes are inconsistent. Farmers use plugin prefix; all others use hardcoded full paths inside route files. Adding insurance routes will require choosing one pattern.

### Prisma Client Path

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '../../generated/prisma/index.js'
```

The Prisma client is NOT at the standard `@prisma/client`. It is at a custom output: `generated/prisma/`.  
**Critical:** Every schema change requires `npx prisma generate` before TypeScript will compile. CI/CD pipelines and Coolify must run this step explicitly.

### Auth Middleware Structure

Three layers in `src/middleware/auth.ts`:
- `verifyToken(request, reply)` — JWT verification, returns 401 on failure
- `optionalAuth(request, reply)` — verifies only if Authorization header present
- `requireRole(...roles)` — verifies token AND checks role enum
- `getUserContext(request)` — full DB-augmented context (farmerId, cooperativeId, institutionId)

Context is cached on `request.authContext` within the same request cycle.

### Role / User Context System

```typescript
enum Role {
  FARMER
  COOP_ADMIN
  MFI_AGENT
  SUPERADMIN
  INSTITUTION_ADMIN
}
```

`AuthUserContext` carries: `userId`, `email`, `role`, `farmerId`, `cooperativeId`, `institutionId`, `institutionRole`.

**Architecture risk:** No `FIELD_AGENT` role exists. Morocco insurance Agent App cannot be built without this.

### CORS / Rate Limit / Security Middleware

| Feature | Status | Notes |
|---------|--------|-------|
| CORS | Restricted allowlist | Hard-coded origins + `CORS_ALLOWED_ORIGINS` env |
| Rate limiting | Custom in-memory buckets | Global / auth / upload / IoT tiers |
| Payload validation | Partial — custom helpers | No schema-level validation (Zod/Yup/Fastify schemas) |
| HTTPS | Handled at proxy level | No SSL in app code (expected for Coolify) |
| CORS missing origins | `assurance-dashboard`, Agent App URLs | **Must add before Morocco launch** |

### Upload Handling

Files stored on local disk under `uploads/`. Static files served via `@fastify/static`. KYC documents (`cni/`, `attestation/`) are blocked at the static-serving hook; served through a protected `GET /v1/upload/farmer/:farmerId/document` endpoint. File size limited (default 5 MB, configurable via `UPLOAD_MAX_BYTES`). Magic-byte validation for PDF.

**Risk:** Local disk storage is not cloud-compatible. Uploads will be lost on container restart unless Coolify mounts a persistent volume.

### Jobs / Cron System

No cron library. Two `setInterval` loops with a `setTimeout` delay on startup:

| Job | Delay | Interval | Action |
|-----|-------|----------|--------|
| `collectWeatherForAllParcelles` | 30s | 1h | Open-Meteo forecast for all parcelles |
| `collectWeatherForAllCoops` | 30s | 1h | Open-Meteo forecast for all coops |
| `generateAlertsForAllFarmers` | 60s | 6h | Weather + NDVI alerts for all farmers |
| `generateAlertsForCoops` | 60s | 6h | IoT-based alerts for coops |

**Risks:**
- Jobs silently die if the Node process restarts between intervals
- No distributed lock — running multiple instances causes duplicate records
- Timezone hardcoded to `Africa/Abidjan` (UTC+0) — wrong for Morocco (UTC+1, UTC+0 in winter)

### Seed Scripts

| File | Purpose | Country |
|------|---------|---------|
| `src/seeds/institutions.ts` | Creates CI financial institutions (Baobab, NSIA, Ecobank, AXA CI…) | Côte d'Ivoire |
| `src/seeds/createInstitutionUsers.ts` | Creates institution admin users | CI |
| `scripts/createTestAdmin.ts` | Creates a test SUPERADMIN | — |
| `scripts/linkFarmerToInstitution.ts` | Links farmer to institution | CI |
| `scripts/resetBaobabDemoAdmin.ts` | Resets demo admin | CI |

**No Morocco seed data exists.**

### Env Variables Currently Used

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | **YES** | — | PostgreSQL connection string |
| `JWT_SECRET` | **YES** | — | JWT signing secret |
| `PORT` | no | 4000 | HTTP port |
| `SENTINEL_CLIENT_ID` | for NDVI | — | Copernicus service account |
| `SENTINEL_CLIENT_SECRET` | for NDVI | — | Copernicus service account |
| `IOT_DEVICE_KEYS` | no | hardcoded fallback | IoT device key registry |
| `CORS_ALLOWED_ORIGINS` | no | — | Extra CORS origins |
| `UPLOAD_MAX_BYTES` | no | 5242880 | Upload size cap |
| `RATE_LIMIT_MAX` | no | 300 | Global req/min per IP |
| `RATE_LIMIT_WINDOW` | no | 60000ms | Rate limit window |
| `AUTH_RATE_LIMIT_MAX` | no | 10 | Auth req/min per IP |
| `UPLOAD_RATE_LIMIT_MAX` | no | 20 | Upload req/min |
| `IOT_RATE_LIMIT_MAX` | no | 600 | IoT ingest req/min |
| `SMTP_*` (implied by nodemailer) | for email | — | Mailer config |

**No Open-Meteo env var** — the API is called with no key (free tier). For production archive calls, an API key may be needed.

### Build / Lint / Test Scripts

```json
"scripts": {
  "dev": "nodemon --exec 'node --loader ts-node/esm' src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio",
  "db:generate": "prisma generate"
}
```

**Missing:** No `lint` script, no `test` script, no `format` script. No ESLint, no Biome, no Vitest, no Jest. **Zero automated tests.**

### Architecture Risks Before Adding Insurance Modules

| Risk | Severity | Details |
|------|---------|---------|
| No `FIELD_AGENT` role | CRITICAL | Agent App cannot authenticate |
| Custom Prisma client path | HIGH | Every schema change needs `prisma generate`; CI must be explicit |
| ESM-only | MEDIUM | Some packages have import issues with ESM; needs careful testing |
| `strict: false` in tsconfig | MEDIUM | Type errors can slip through; insurance logic needs types |
| No test suite | HIGH | Cannot safely add 20+ new models/routes without regression coverage |
| In-memory rate limiting | MEDIUM | Does not survive restart; multi-instance breaks |
| No cron library | MEDIUM | Jobs not reliable in production restarts |
| Local disk uploads | MEDIUM | Volume persistence required; no S3/CDN |
| Hardcoded CI timezone/coords | HIGH | Wrong for Morocco |
| CORS missing insurance dashboard origin | HIGH | Dashboard blocked until added |

---

## SECTION 2 — Current Data Model Inventory

### Models overview

The schema has **18 models** across `prisma/schema.prisma` plus 4 enum types.

---

### User

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | Primary key |
| email | String unique | Login identity |
| passwordHash | String | bcrypt hash |
| role | Role enum | FARMER / COOP_ADMIN / MFI_AGENT / SUPERADMIN / INSTITUTION_ADMIN |

**For Morocco insurance:** Missing `FIELD_AGENT` role. Extension needed.  
**Reuse:** YES, as identity anchor. Add `FIELD_AGENT` to Role enum.

---

### Farmer

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | — |
| userId | String unique | FK to User |
| firstName / lastName | String | — |
| phone | String | Free text, no Morocco validation |
| region | String | Free text, not structured |
| village | String | Free text |
| lat / lng | Float | Point GPS |
| surface | Float | Total surface in ha |
| kycStatus | KycStatus enum | PENDING / VALIDATED / REJECTED |
| photoUrl | String? | Relative path to upload |
| cniUrl | String? | Document URL (path) |
| attestationUrl | String? | Document URL (path) |
| cooperativeId | String? | FK to Cooperative |
| blockchainId | String? | On-chain anchor ID |
| experienceAnnees | String? | Free-text experience |
| revenusAnnexes | String? | Free-text revenues |
| historicCredit | String? | Free-text credit history |

**Missing for Morocco:**
- No `country` field
- No `cin` field (CIN number, not document URL)
- No `province` or `commune` field
- No `dateNaissance` field
- No `sexe` field
- No `cndpConsent` boolean
- No `cndpConsentAt` datetime
- No `insuredSince` field
- `region` is free text, not a typed enum or reference to Moroccan provinces

**Reuse:** YES as base farmer record. Extension required. Adding fields is non-breaking.  
**Risk:** Changing existing string fields would require migration. Only **add** new optional fields.

---

### Parcelle

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | — |
| farmerId | String | FK to Farmer |
| name | String | Free text |
| culture | String | Crop name, free text |
| superficie | Float | In ha |
| lat / lng | Float | Centroid GPS |
| ndvi | Float | Single current value, not history |
| statut | String | Free text ("active", etc.) |
| polygone | String? | JSON string, GeoJSON-like |
| stade | String? | Crop stage (PREPARATION…POST_RECOLTE) |
| datePlantation | DateTime? | — |
| historique | String? | Free text history notes |

**Missing for Morocco:**
- No `country`
- No `province` / `commune`
- `polygone` stored as JSON string (not PostGIS, no spatial queries)
- No `ndviHistory` — single ndvi value only, no historical series
- No `riskZone` field
- No `elevation` / `slope` fields for flood exposure
- `culture` is free text — no reference to Moroccan insurance crop categories

**Reuse:** YES as parcelle anchor. Extension required.  
**Key insight:** `polygone` as JSON string is enough for Haversine proximity calculations. PostGIS not required for MVP hydro risk.

---

### Cooperative

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | Manual `coop-${Date.now()}` format |
| name | String | — |
| rccm | String unique | Moroccan equivalent: ICE/RC Registre |
| region | String | Free text |
| filiere | String | Crop category, free text |
| surface | Float | — |
| foundedAt | DateTime | — |
| lat / lng | Float | — |
| logoUrl | String? | — |
| institutionId | String? | FK to Institution |

**Missing for Morocco:** No `country` field. `rccm` field (Ivorian business registry format) should be renamed or extended for Morocco's ICE/RC. No Morocco-specific fields.

**Reuse:** Partially. Cooperative concept is valid for Morocco; field labels need Morocco context.

---

### Institution

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | — |
| name | String | — |
| type | String | "MFI", "BANQUE", "ASSURANCE" |
| country | String | Default **"CI"** |
| modules | String[] | Array of enabled module strings |
| plan | String | "STANDARD" |
| active | Boolean | — |

**For Morocco assurance:** `country` exists but defaults to "CI". A Morocco insurer would be `country: "MA"`. Type "ASSURANCE" already exists in seed data. **Reusable with country override.**

---

### InstitutionUser

Links User ↔ Institution with a `role` string field (defaults `"ANALYST"`). No enum, no `FIELD_AGENT`.

---

### CreditScore

Single score record per farmer (1:1). Fields: score (0-1000), scoreMax, status, risk factors. Scoring is the Wakama 4C model.

**For insurance:** This score can be one input to insurance risk pricing but is not sufficient alone. The insurance RAX/WRS score requires weather + NDVI + hydro exposure — not present in this model.

---

### Loan / Transaction

Active microcredit loan records and payment transactions. **Not relevant to insurance** but could indicate farmer financial stability.

---

### Alert

Polymorphic alert — links to farmerId, coopId, or parcelleId. Types: METEO, NDVI, IOT. Free-text severity.

**For insurance:** Can be extended with insurance-specific alert types (FLOOD_RISK, DROUGHT_ALERT, etc.). Currently generated automatically by the weather job.

---

### IoTNode / IoTReading

IoT sensor hardware nodes (ESP32) and their readings. Currently tied to cooperatives or farmers. Data stored in WeatherHistory for ML training.

**For insurance:** IoT data is valuable for weather-indexed insurance trigger verification. Reusable.

---

### WeatherHistory

Extensive table with forecast weather data linked to parcelle / cooperative / farmer. 

**Critical issue for Morocco:** `country` field defaults to `"CI"`. All records from the scheduler will have `country = "CI"` unless the collector is updated. Morocco records will not be distinguishable.

**For archive:** This model can store archive data. Add `source: String` (FORECAST / ARCHIVE / IOT) and `country` filtering, and this is reusable.

---

### Activity / Message

Farmer activity declarations and cooperative messaging. Relevant for scoring/history, not directly for insurance.

---

### CreditRequest / CreditDecision / InstitutionScoringConfig

Credit workflow models. Not directly applicable to insurance, but the decision pattern can be mirrored for insurance application decisions.

---

### IotKitRequest

Hardware kit requests. Not relevant to insurance.

---

### ApiKey

API key model linked to User. Currently unused in route protection.

---

### Models Summary Table

| Model | Insurance Useful? | Needs Extension | Breaking Risk |
|-------|------------------|-----------------|---------------|
| User | YES | Add FIELD_AGENT role | LOW — additive |
| Farmer | YES | country, cin, province, cndpConsent | LOW — all nullable |
| Cooperative | PARTIAL | country | LOW |
| Parcelle | YES | country, riskZone, ndviHistory link | LOW |
| Institution | YES | type "ASSURANCE" already exists | LOW |
| InstitutionUser | PARTIAL | roles for FIELD_AGENT | LOW |
| CreditScore | PARTIAL | Insurance scoring is different | LOW |
| Alert | YES | New alert types | LOW |
| WeatherHistory | YES | source field, country fix | LOW |
| IoTNode/Reading | YES | Already usable | NONE |
| Loan/Transaction | NO | — | NONE |
| Activity/Message | NO | — | NONE |
| CreditRequest | NO | Pattern reusable | NONE |

---

## SECTION 3 — Current API Endpoint Inventory

### Auth Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| POST | /v1/auth/register | None | Any | Creates User + optional Farmer profile |
| POST | /v1/auth/login | None | Any | Returns JWT + farmerId + institutionId |
| POST | /v1/auth/institution-login | None | INSTITUTION_ADMIN only | Dedicated institution login |
| GET | /v1/auth/me | verifyToken | Any | Returns user + farmer + coopId |
| POST | /v1/auth/send-verification | None | Any | Sends email verification code |
| POST | /v1/auth/verify-code | None | Any | Verifies email code |

**Reuse by Insurance:** All reusable. Add `FIELD_AGENT` login path.

---

### Farmers Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| GET | /v1/farmers | optionalAuth | Any | Paginated list; tenant-aware if token provided |
| GET | /v1/farmers/:id | **None** | Any | **Returns cniUrl, attestationUrl, photoUrl publicly** |
| GET | /v1/farmers/:id/dossier-comite | verifyToken | Any | Full credit dossier |
| POST | /v1/farmers | **None** | Any | **UNPROTECTED creation — CRITICAL** |
| PATCH | /v1/farmers/:id | verifyToken | Contextual | Protected update |

**Risks:**  
- `GET /v1/farmers/:id` is public and returns raw `cniUrl` and `attestationUrl` paths — **PII exposure**  
- `POST /v1/farmers` has no authentication — anyone can create a farmer record

**Reuse by Insurance:** YES. Will need to protect GET /:id for Morocco real data.

---

### Cooperatives Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| GET | /v1/cooperatives | optionalAuth | Any | Tenant-aware |
| GET | /v1/cooperatives/:id | **None** | Any | Public |
| POST | /v1/cooperatives | verifyToken | Any | Protected |
| PATCH | /v1/cooperatives/:id | verifyToken | Contextual | Protected |

---

### Parcelles Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| GET | /v1/parcelles | **None** | Any | Publicly filterable by farmerId |
| POST | /v1/parcelles | verifyToken | FARMER/COOP_ADMIN/SUPERADMIN | Protected |
| PATCH | /v1/parcelles/:id | verifyToken | Contextual | Protected |
| DELETE | /v1/parcelles/:id | verifyToken | Contextual | Protected |

---

### Scores Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| GET | /v1/scores/:farmerId | **None** | Any | **Full 4C score returned publicly** |
| GET | /v1/scores/coop/:coopId | **None** | Any | All farmers' scores for a coop |

**Risk:** Score with credit analysis is exposed with no auth.

---

### Alerts Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| GET | /v1/alerts | **None** | Any | Filterable by farmerId/coopId |
| PATCH | /v1/alerts/:id/read | verifyToken | Contextual | Protected |
| PATCH | /v1/alerts/read-all | verifyToken | Contextual | Protected |

---

### Weather Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| GET | /v1/weather/history/:parcelleId | **None** | Any | Public weather records |
| GET | /v1/weather/history/farmer/:farmerId | **None** | Any | Public weather records |

---

### NDVI Routes

| Method | Path | Auth | Roles | Notes |
|--------|------|------|-------|-------|
| GET | /v1/ndvi/:parcelleId | **None** | Any | Fetches live from Copernicus, updates DB |
| GET | /v1/ndvi/parcelle/:parcelleId/image | **None** | Any | Returns PNG image from Sentinel |

---

### IoT Routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | /v1/iot/ingest | X-Device-Key header | IoT device authentication |
| GET | /v1/iot/node | **None** | Public |
| GET | /v1/iot/readings/:nodeId | **None** | Public |

---

### Activities / Messages / Credit / IoT Kit

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | /v1/activities | verifyToken | Protected |
| GET | /v1/activities | **None** | Public |
| POST | /v1/messages | verifyToken | Protected |
| GET | /v1/messages | **None** | Public |
| POST | /v1/credit-requests | verifyToken | Protected |
| GET | /v1/credit-requests | optionalAuth | Tenant-aware |
| PATCH | /v1/credit-requests/:id/approve | requireRole INSTITUTION_ADMIN/MFI_AGENT/SUPERADMIN | Protected |
| PATCH | /v1/credit-requests/:id/reject | requireRole INSTITUTION_ADMIN/MFI_AGENT/SUPERADMIN | Protected |
| POST | /v1/iot-kit-requests | verifyToken | Protected |

---

### Upload Routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | /v1/upload/farmer/:farmerId/photo | verifyToken | Rate-limited |
| POST | /v1/upload/farmer/:farmerId/document | verifyToken | Magic-byte validated |
| GET | /v1/upload/farmer/:farmerId/document | verifyToken | Protected download |
| POST | /v1/upload/cooperative/:coopId/logo | verifyToken | Rate-limited |

---

### Institutions Routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | /v1/institutions | **None** | Public list |
| GET | /v1/institutions/:id | **None** | Public |
| POST | /v1/institutions | requireRole SUPERADMIN | Protected |
| GET | /v1/institutions/:id/users | **None** | Public |
| POST | /v1/institutions/:id/decisions | requireRole INSTITUTION_ADMIN/MFI_AGENT/SUPERADMIN | Protected |
| GET | /v1/institutions/:id/decisions | **None** | **Public — exposes credit decisions** |
| PATCH | /v1/institutions/decisions/:id | requireRole INSTITUTION_ADMIN/MFI_AGENT/SUPERADMIN | Protected |
| GET | /v1/institutions/:id/scoring-config | **None** | Public |
| PATCH | /v1/institutions/:id/scoring-config | requireRole INSTITUTION_ADMIN/SUPERADMIN | Protected |

**No insurance routes exist anywhere in the codebase.**

---

### Insurance-Specific Endpoints

| Status | Category |
|--------|---------|
| MISSING | Insurance applications |
| MISSING | Insurance missions |
| MISSING | Field audit sync |
| MISSING | RAX/WRS calculation |
| MISSING | Pricing generation |
| MISSING | Policy management |
| MISSING | Claims management |
| MISSING | Morocco reference data (dams, rivers, communes) |
| MISSING | NDVI history endpoint |
| MISSING | Weather archive endpoint |
| MISSING | Hydro risk endpoint |

---

## SECTION 4 — Security / PII / CNDP Readiness

### Risk Matrix

#### CRITICAL Risks

| # | Location | Issue | Impact on Morocco | Fix Required Before Real Data |
|---|---------|-------|------------------|-------------------------------|
| C1 | `routes/farmers.ts:58` | `GET /v1/farmers/:id` is **public** and returns `cniUrl`, `attestationUrl`, `photoUrl` in the response body | Moroccan CIN document URL exposed to anyone with a farmer ID | YES |
| C2 | `routes/farmers.ts:102` | `POST /v1/farmers` has **no authentication** — any anonymous client can create farmer records | Fake/spam farmers pollute production database before insurance pilot | YES |
| C3 | `routes/scores.ts:13` | `GET /v1/scores/:farmerId` is **public** and returns complete financial scoring | Financial risk profiles accessible without auth | YES |
| C4 | Schema everywhere | **No CNDP consent fields** anywhere in the schema | Cannot legally process Moroccan personal data without explicit consent | YES |
| C5 | Schema: Farmer | **No CIN number field** — only `cniUrl` (document image URL) | Cannot do identity verification for Morocco pilot | YES |

#### HIGH Risks

| # | Location | Issue | Impact | Fix |
|---|---------|-------|--------|-----|
| H1 | `routes/institutions.ts:126` | `GET /v1/institutions/:id/decisions` is **public** and returns all credit decisions | Confidential credit decisions exposed | Protect with verifyToken |
| H2 | `lib/security.ts` | CORS allowlist does NOT include `assurance-dashboard` or Agent App origins | Dashboard blocked at CORS layer | Add origins before launch |
| H3 | `routes/iot.ts:7` | IoT device key **hardcoded in source code**: `etra_esp32_001__K2v9F6pQxW3dR8nH1sL4aT7yU0iO5pB` | Key is in git history; anyone with repo access can forge IoT payloads | Move to env only |
| H4 | Entire codebase | **No audit log model** — no record of who accessed or modified sensitive data | Cannot demonstrate CNDP compliance for real farmer data | Create AuditLog before real data |
| H5 | `routes/alerts.ts:13` | `GET /v1/alerts` is public with farmerId filter | Any caller knowing a farmerId can retrieve all farmer alerts | Protect or require auth |
| H6 | `routes/parcelles.ts:18` | `GET /v1/parcelles` is public with farmerId filter | GPS coordinates + crop data exposed | Protect for Morocco |
| H7 | `lib/verificationCodes.ts` | Email verification codes stored in **in-memory Map** | Codes lost on process restart; reliability issue | Use Redis or DB |

#### MEDIUM Risks

| # | Location | Issue | Impact | Fix |
|---|---------|-------|--------|-----|
| M1 | `jobs/weatherCollector.ts` | Timezone hardcoded as `Africa/Abidjan` (UTC+0) | Morocco is UTC+1; hourly weather records will be offset by 1h | Fix before Morocco data |
| M2 | `jobs/weatherCollector.ts` | WeatherHistory `country` defaults to "CI" | Morocco weather records indistinguishable from CI records | Add country parameter |
| M3 | `routes/iot.ts:68` | IoT fallback creates node with hardcoded Côte d'Ivoire coordinates (7.4882, 4.8133) | Wrong coords if a Morocco IoT device uses fallback path | Fix before IoT in Morocco |
| M4 | `tsconfig.json` | `"strict": false` | Type errors can slip through insurance calculation logic | Enable strict mode |
| M5 | No GeoJSON sanitisation | `polygone` field accepted as any JSON string | Malformed GeoJSON could cause NDVI calculation to fail silently | Validate on write |
| M6 | `routes/institutions.ts:51` | `GET /v1/institutions/:id/users` is public | Institution user list exposed | Protect |

#### LOW Risks

| # | Issue | Impact |
|---|-------|--------|
| L1 | No Swagger/OpenAPI | Integration risk for agent app and Morocco dashboard |
| L2 | No automated tests | Cannot safely verify insurance modules don't break existing API |
| L3 | Console.log diagnostic messages in production routes (`institution-login`, `PATCH_PARCELLE_BODY`) | Log flooding / info leakage |
| L4 | `GET /v1/messages` public | Message content accessible with cooperativeId |
| L5 | `GET /v1/activities` public | Farming activity history accessible with farmerId |

### PII Summary

| Field | Currently | Risk for Morocco |
|-------|-----------|-----------------|
| cniUrl | Returned raw in public GET | HIGH — Moroccan CIN document path exposed |
| attestationUrl | Returned raw in public GET | HIGH |
| photoUrl | Returned raw in public GET | MEDIUM |
| email | Returned in GET /auth/me | LOW — requires auth |
| phone | Returned in GET /farmers (public) | HIGH — phone exposed |
| lat/lng | Returned in public GET | MEDIUM — GPS home location |
| CIN number | NOT stored | MISSING — needed for identity |
| CNDP consent | NOT modeled | CRITICAL — legally required |

---

## SECTION 5 — Morocco Readiness

| Feature | Status | Location | Recommendation |
|---------|--------|---------|----------------|
| `country` field on Farmer | MISSING | Farmer model | Add `country String @default("MA")` |
| `country` field on Parcelle | MISSING | Parcelle model | Add `country String @default("MA")` |
| `country` field on Cooperative | MISSING | Cooperative model | Add `country String @default("MA")` |
| `country` on Institution | EXISTS | `country String @default("CI")` | Change default / pass "MA" |
| `country` on WeatherHistory | EXISTS | `country String @default("CI")` | Fix default and job |
| Morocco province/commune | MISSING | — | Add `province String?` and `commune String?` to Farmer/Parcelle |
| Moroccan CIN number field | MISSING | Farmer model | Add `cin String?` — store CIN number (not just document) |
| Moroccan phone validation | MISSING | routes/farmers.ts | Add regex `^(?:\+212\|0)[5-7]\d{8}$` |
| CNDP consent | MISSING | Farmer model | Add `cndpConsent Boolean @default(false)` + `cndpConsentAt DateTime?` |
| Moroccan crops | MISSING | lib/wakamaScore.ts | Replace CI crop list with Moroccan crops (Blé, Orge, Maïs, Olives, Agrumes, etc.) |
| Insurance crop categories | MISSING | — | New model `InsuranceCropCategory` linked to Moroccan national crop codes |
| Ksar El-Kébir / Larache / Loukkos | NOT PRESENT | — | Seed data needed |
| Moroccan dams | MISSING | — | New model `MoroccoDam` |
| Rivers / Oueds | MISSING | — | New model `MoroccoRiverSegment` |
| Flood risk zones | MISSING | — | New model `MoroccoFloodRiskZone` |
| Hydrological exposure | MISSING | — | Computed field or new model |
| Rainfall/flood history | MISSING | — | Weather archive required |
| Morocco weather archive | MISSING | — | New Open-Meteo archive service |
| Morocco NDVI history | MISSING | — | New NdviHistory model + Copernicus historical call |

### Morocco Reference Data Needed

The following static reference data does NOT exist in the backend:

1. **Moroccan provinces and communes** — for address validation
2. **Moroccan dams** — at minimum: Loukkos dam, Oued Loukkos, Oued Makhazine (near Ksar El-Kébir)
3. **Moroccan flood risk zones** — Loukkos basin flood plains
4. **Moroccan insurance crop categories** — aligned with Ministry of Agriculture codes
5. **Morocco-specific alert thresholds** — different rainfall patterns from CI
6. **Ksar El-Kébir parcelle seed** — for the demo pilot farmer

---

## SECTION 6 — Weather Archive Readiness

### Current State

| Question | Answer |
|----------|--------|
| Open-Meteo used? | YES |
| Forecast or archive? | **FORECAST ONLY** — `/v1/forecast` with `forecast_days=1` (WeatherCollector) and `forecast_days=3` (AlertsGenerator) |
| Archive API used? | **NO** — Open-Meteo has `/v1/archive` but it is not implemented |
| Histories stored? | YES — WeatherHistory model, hourly records per parcelle/coop |
| Linked to Farmer/Parcelle? | YES — WeatherHistory.parcelleId, farmerId, coopId |
| Backend caches API? | **NO** — direct fetch every call, 100ms delay between iterations |
| Timezone? | Hardcoded `Africa/Abidjan` (wrong for Morocco) |
| Country? | `country = "CI"` hardcoded in IoT ingest; empty in weather collector |
| Failure handling? | `try/catch` with `console.error` — silent continue |
| API key? | Not required for free tier; may be needed for archive API with high frequency |

### Recommended Architecture for Morocco Weather Archive

**Service:** `src/lib/weatherArchive.ts`

```
fetchOpenMeteoArchive(lat, lng, startDate, endDate, timezone) → WeatherDayRecord[]
```

**Model:** Add `WeatherHistoryArchive` (or reuse `WeatherHistory` with `source: "ARCHIVE"` and `recordedDate: Date` separate from `recordedAt` timestamp).

**Strategy:**
- On parcelle creation (Morocco), trigger one-time backfill of last 10 years
- Store one record per day per parcelle
- Deduplicate by `(parcelleId, recordedDate)` unique index
- Rate limit: respect Open-Meteo free tier (max 10,000 calls/day)

**Recommended `source` field on WeatherHistory:**
```
source String @default("FORECAST") // FORECAST | ARCHIVE | IOT | SEED_DEMO
```

**Cache strategy:** Archive data is static — cache indefinitely. For scheduled data: cache 1 hour per location.

**Env vars to add:**
```
OPEN_METEO_API_KEY=  # optional; blank = free tier
MOROCCO_TIMEZONE=Africa/Casablanca
```

---

## SECTION 7 — NDVI / Copernicus Readiness

### Current State

| Question | Answer |
|----------|--------|
| Copernicus integrated? | YES |
| Which API? | Sentinel Hub SentinelHub Statistics API + Process API |
| Credentials env-based? | YES — `SENTINEL_CLIENT_ID`, `SENTINEL_CLIENT_SECRET` |
| Guard if missing? | **NO** — will crash at runtime if env vars absent |
| Calculates NDVI live? | YES — fetches last 90 days stats from Copernicus |
| Historical NDVI? | **NO** — 90-day rolling window only, single mean value returned |
| NDVI values stored? | Partially — updates single `ndvi` Float on Parcelle |
| NDVI histories linked to Parcelle? | **NO** — no NdviHistory model |
| Supports Sentinel-2 history? | Technically YES via aggregation intervals, but not implemented |
| Error handling? | try/catch with 500 response |
| Morocco-compatible? | YES — Sentinel-2 covers Morocco |

### Recommended Architecture for NDVI History

**Model:** `NdviHistory`
```prisma
model NdviHistory {
  id          String   @id @default(cuid())
  parcelleId  String
  date        DateTime
  ndvi        Float
  source      String   // "COPERNICUS" | "SEED_DEMO"
  cloudCover  Float?
  createdAt   DateTime @default(now())

  parcelle Parcelle @relation(fields: [parcelleId], references: [id])

  @@unique([parcelleId, date])
  @@index([parcelleId, date])
}
```

**Service:** `src/lib/ndviHistory.ts`
- Call Copernicus Statistics API with 30-day aggregation intervals
- Store one record per 30-day period per parcelle
- Backfill up to 3 years on parcelle creation
- Update monthly via scheduler

**Credentials / env:**
```
SENTINEL_CLIENT_ID=      # Required — guard on startup
SENTINEL_CLIENT_SECRET=  # Required — guard on startup
```

**Seed / demo fallback:**
- If `SENTINEL_CLIENT_ID` is absent → use CSV seed data labeled `source: "SEED_DEMO"`
- Never mix SEED_DEMO with real Copernicus data in the same parcelle

**Endpoint design:**
```
GET /v1/ndvi/history/:parcelleId?months=12
```
Returns: `[{ date, ndvi, source, cloudCover }]`

---

## SECTION 8 — Hydro / Flood Risk Readiness

### Current GIS State

| Feature | Status |
|---------|--------|
| Haversine distance | MISSING — not implemented anywhere |
| GeoJSON parsing | PARTIAL — basic parsing in NDVI route for bbox calculation only |
| Point-in-polygon | MISSING |
| Polygon area calculation | MISSING |
| Geospatial libraries | NONE installed (no turf.js, no postgis extension) |
| PostGIS | NOT configured |
| Parcelle polygon storage | String (JSON text) — GeoJSON format, not typed |

### Parcelle Geometry Assessment

- `polygone` field: JSON string, valid GeoJSON (Feature or Polygon)
- `lat`/`lng`: centroid point — exists on all parcelles
- `superficie`: exists in hectares
- No elevation/slope data
- No flood zone reference

This is **sufficient for Haversine-based MVP hydro risk** without PostGIS.

### Recommended MVP Hydro Risk Architecture

**New static reference models:**

```prisma
model MoroccoDam {
  id       String  @id @default(cuid())
  name     String
  oued     String
  province String
  lat      Float
  lng      Float
  capacityMm3 Float?
  riskZone String  // "HIGH" | "MEDIUM" | "LOW"
}

model MoroccoRiverSegment {
  id       String @id @default(cuid())
  name     String
  oued     String
  province String
  lat      Float
  lng      Float
  type     String // "MAIN" | "TRIBUTARY"
  floodRisk String // "HIGH" | "MEDIUM" | "LOW"
}

model MoroccoFloodRiskZone {
  id       String @id @default(cuid())
  name     String
  province String
  commune  String
  riskLevel String // "HIGH" | "MEDIUM" | "LOW"
  notes    String?
  // Optional: polygonGeoJson String?
}
```

**Utility:** `src/lib/geoUtils.ts`
```typescript
haversineKm(lat1, lng1, lat2, lng2): number
nearestFeature<T extends {lat, lng}>(point, features): T & { distanceKm: number }
```

**No heavy GIS library needed for MVP.** Turf.js is optional and can be added later for point-in-polygon flood zone checks.

**Ksar El-Kébir seed data to add:**
- Oued Loukkos: lat ~35.0, lng ~-5.9
- Barrage Oued Makhazine: lat ~34.97, lng ~-5.58
- Flood zone: Loukkos plain (HIGH risk below 20m elevation)

**Source confidence levels:**
- `"OFFICIAL_ABHS"` — Direction de la Recherche et de la Planification de l'Eau
- `"MANUAL_SEED"` — manually entered for pilot
- `"ESTIMATED"` — approximate

---

## SECTION 9 — Insurance Workflow Readiness

### Workflow Completeness

| Step | Existing Support | Missing |
|------|-----------------|---------|
| Insurance application | NONE | InsuranceApplication model, endpoints |
| Mission configuration | NONE | InsuranceMission model |
| Field audit | NONE | FieldAudit model, sync endpoint |
| Arbitrage | NONE | Arbitrage model, close endpoint |
| RAX / WRS calculation | NONE | RaxScore model, calculation engine |
| Pricing generation | NONE | InsurancePricing model |
| Policy management | NONE | InsurancePolicy model |
| Monitoring | PARTIAL (alerts exist) | Insurance-specific alert types |
| Claims | NONE | InsuranceClaim model |
| Settings / versioning | NONE | InsuranceSettingsVersion model |
| Audit trail | NONE | AuditLog model |
| Solana anchoring | PARTIAL (blockchainId on Farmer/Cooperative exists) | AnchorHash model, anchor service |

### Status Enums Missing

```typescript
enum InsuranceApplicationStatus {
  DRAFT, SUBMITTED, UNDER_REVIEW, OFFER_SENT, ACCEPTED, REFUSED, EXPIRED
}
enum MissionStatus {
  PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
}
enum FieldAuditStatus {
  PENDING_SYNC, SYNCED, VALIDATED, DISPUTED
}
enum ArbitrageStatus {
  OPEN, REVIEWED, CLOSED_APPROVED, CLOSED_REJECTED
}
enum ClaimStatus {
  DECLARED, UNDER_INVESTIGATION, APPROVED, REJECTED, PAID
}
```

### Required Models for Phase 27

1. `InsuranceApplication` — core application linked to Farmer + Parcelles
2. `InsuranceOffer` — offer from insurer to farmer
3. `InsuranceMission` — field audit mission assigned to FIELD_AGENT
4. `FieldAudit` — completed field audit, GPS polygon, photos, hash
5. `RaxScore` — Risk, Agri, eXposure score per application
6. `InsurancePricing` — calculated premium per application
7. `InsurancePolicy` — issued policy (insurer validates)
8. `MonitoringRecord` — ongoing triggered alerts per policy
9. `InsuranceClaim` — claim declaration and status
10. `InsuranceSettingsVersion` — versioned config for scoring/pricing params
11. `AuditLog` — generic audit trail (who, what, when, on what entity)
12. `NdviHistory` — NDVI time series per parcelle
13. `WeatherArchive` (source field on WeatherHistory) — historical weather
14. `MoroccoDam` — dam reference
15. `MoroccoRiverSegment` — river reference
16. `MoroccoFloodRiskZone` — flood risk zone reference
17. `InsuranceCropCategory` — Morocco insurance crop codes

### Role Protection Gaps

| Action | Required Role | Currently |
|--------|--------------|-----------|
| Submit application | FARMER | MISSING |
| Review application | INSTITUTION_ADMIN (insurer) | MISSING |
| Create mission | INSTITUTION_ADMIN | MISSING |
| Sync field audit | FIELD_AGENT | Role doesn't exist |
| Calculate RAX | INSTITUTION_ADMIN | MISSING |
| Issue policy | INSTITUTION_ADMIN | MISSING |
| Declare claim | FARMER | MISSING |
| Arbitrage close | SUPERADMIN / INSTITUTION_ADMIN | MISSING |

---

## SECTION 10 — Agent App Readiness

### Current Backend Support

| Requirement | Status | Notes |
|-------------|--------|-------|
| FIELD_AGENT role | **MISSING** | Not in Role enum |
| Agent login | **MISSING** | No /v1/auth/agent-login or specific flow |
| Mission list for agent | **MISSING** | No mission model |
| Mission detail | **MISSING** | — |
| Field audit sync | **MISSING** | No sync endpoint |
| Upload photos/docs | PARTIAL | Upload exists for farmer/coop; not for audits |
| GPS polygon payload | PARTIAL | Parcelle accepts polygon string |
| Local hash / server hash | **MISSING** | No hash verification pattern |
| Sync status tracking | **MISSING** | No offline sync state |
| Agent audit logs | **MISSING** | No AuditLog model |
| Anti-fraud flags | **MISSING** | — |
| Source labeling LIVE/SEED_DEMO | **MISSING** | No source field on audit records |

### Recommended API Contract for Field Audit Sync

```
POST /v1/insurance/field-audit/sync
Authorization: Bearer <FIELD_AGENT token>

Request body:
{
  missionId: string,
  farmerId: string,
  parcelleId: string,
  syncedAt: string (ISO 8601),
  
  // GPS capture
  gpsPolygon: string (GeoJSON),
  gpsAccuracyMeters: number,
  
  // Observations
  observations: {
    cropType: string,
    cropStage: string,
    estimatedSurface: number,
    vegetationCondition: string,   // "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR" | "NONE"
    irrigationVisible: boolean,
    pestDamageVisible: boolean,
    floodTraceVisible: boolean,
    notes: string?
  },
  
  // Photos
  photoUrls: string[],   // already uploaded via /v1/upload/*
  
  // Integrity
  localHash: string,     // SHA-256 of canonical payload before upload
  deviceId: string,      // agent device fingerprint
  offlineDuration: number? // seconds the device was offline before sync
}

Response 201:
{
  fieldAuditId: string,
  serverHash: string,    // SHA-256 of stored record
  status: "SYNCED",
  warnings: string[]     // e.g., gps accuracy too low, hash mismatch
}
```

---

## SECTION 11 — Farmer App Assurance Readiness

### Current Backend Support

| Requirement | Status | Notes |
|-------------|--------|-------|
| Create insurance application | **MISSING** | No endpoint, no model |
| Province/commune lookup | **MISSING** | No reference data |
| Crop type list | **MISSING** | Hardcoded only in scoring engine |
| Parcel selection | PARTIAL | Parcelles endpoint exists |
| CNDP consent | **MISSING** | No field, no endpoint |
| Application status tracking | **MISSING** | — |
| Offer acceptance/refusal | **MISSING** | — |
| Policy detail | **MISSING** | — |
| Claim visibility | **MISSING** | — |

### Recommended API Contracts

```
POST /v1/insurance/applications
Authorization: Bearer <FARMER token>
Body: {
  farmerId, parcelleIds[], cropType, surface, province, commune,
  cndpConsent: true, cndpConsentAt: ISO-date
}

GET /v1/insurance/applications?farmerId=xxx
Authorization: Bearer

GET /v1/insurance/applications/:id
Authorization: Bearer

POST /v1/insurance/offers/:id/farmer-decision
Authorization: Bearer <FARMER token>
Body: { decision: "ACCEPT" | "REFUSE", signedAt: ISO-date }
```

---

## SECTION 12 — Dashboard Readiness

### Assurance Dashboard Endpoint Readiness

| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /v1/insurance/applications | MISSING | — |
| GET /v1/insurance/applications/:id | MISSING | — |
| GET /v1/insurance/missions | MISSING | — |
| GET /v1/insurance/missions/:id | MISSING | — |
| GET /v1/insurance/field-audits | MISSING | — |
| POST /v1/insurance/arbitrage/:id/close | MISSING | — |
| POST /v1/insurance/rax/calculate | MISSING | — |
| POST /v1/insurance/pricing/generate | MISSING | — |
| GET /v1/insurance/policies | MISSING | — |
| GET /v1/insurance/policies/:id | MISSING | — |
| GET /v1/insurance/monitoring/alerts | MISSING | — |
| GET /v1/insurance/claims | MISSING | — |
| GET /v1/insurance/claims/:id | MISSING | — |
| GET /v1/insurance/settings/versions | MISSING | — |
| GET /v1/insurance/reports/analytics | MISSING | — |

### Existing Endpoints Reusable by Dashboard

| Endpoint | Reusable | Notes |
|----------|---------|-------|
| GET /v1/farmers | YES | Needs auth tightening for Morocco PII |
| GET /v1/farmers/:id | YES | Must require auth before Morocco data |
| GET /v1/farmers/:id/dossier-comite | YES | Already protected |
| GET /v1/parcelles?farmerId= | YES | Needs auth tightening |
| GET /v1/scores/:farmerId | YES | Needs auth tightening |
| GET /v1/ndvi/:parcelleId | YES | Already functional |
| GET /v1/weather/history/:parcelleId | YES | Needs archive source |
| GET /v1/alerts?farmerId= | YES | Needs auth |

### Frontend Migration Risks

| Risk | Severity |
|------|---------|
| SEED_DEMO data mixed with real data | HIGH — must add `source` labeling |
| Dashboard currently expects CI-specific scoring (Baobab, NSIA products) | HIGH — scoring engine must detect Morocco context |
| No pagination on several list endpoints | MEDIUM — performance risk |
| No response envelope standard (`data`/`total`/`page`) on all routes | MEDIUM — inconsistent shapes |
| CORS missing assurance dashboard origin | CRITICAL — dashboard blocked |

---

## SECTION 13 — Migration and Deployment Risk

### Prisma Schema Addition Risk

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Generated client path `../../generated/prisma` | HIGH | Run `prisma generate` in CI/CD; path must be consistent |
| 10 existing migrations | LOW | Additive migrations are safe |
| Enum additions (new Role values) | MEDIUM | Postgres ALTER TYPE requires migration; test on staging first |
| New models linked to Farmer | LOW | Non-destructive FKs |
| Changing `country` defaults | MEDIUM | Existing records keep "CI" default — migration needed to set "MA" selectively |

### Deployment (Coolify) Risk

| Item | Risk | Notes |
|------|------|-------|
| `prisma generate` in build | HIGH | If not in Dockerfile/build script, generated client will be stale |
| Local disk uploads | HIGH | Uploads lost on restart without persistent volume |
| In-memory rate limiting | LOW | Resets on restart — acceptable |
| `setTimeout` jobs | MEDIUM | Restart during collection causes missed intervals |
| `PORT` env var | LOW | Has fallback to 4000 |

### Node Version

Not specified in `package.json`. Recommend adding `"engines": { "node": ">=20" }`.

### Safe Rollout Strategy

```
Step 1: Schema additions only (no model modifications)
  - Add FIELD_AGENT to Role enum
  - Add country, cin, province, commune, cndpConsent to Farmer
  - Add country to Parcelle, Cooperative
  - Add NdviHistory model
  - Add source field to WeatherHistory
  - Add all insurance workflow models
  → Run: npx prisma generate
  → Run: npx prisma migrate dev --name add_morocco_insurance_backbone

Step 2: Seed Morocco reference data
  - MoroccoDam seed (Loukkos basin)
  - MoroccoRiverSegment seed
  - MoroccoFloodRiskZone seed
  - InsuranceCropCategory seed (Morocco)
  - Wakama Assurance Maroc institution seed
  → Run: npx tsx src/seeds/morocco-references.ts

Step 3: Add read endpoints (no write)
  - GET /v1/insurance/crop-types
  - GET /v1/insurance/provinces
  - GET /v1/ndvi/history/:parcelleId
  - GET /v1/weather/archive/:parcelleId

Step 4: Add write endpoints (protected)
  - POST /v1/insurance/applications
  - POST /v1/insurance/field-audit/sync
  → Deploy with CORS update for assurance dashboard

Step 5: Connect dashboard

Step 6: Connect Farmer App

Step 7: Connect Agent App
```

---

## SECTION 14 — Recommended Phase 27 Implementation Plan

### P0 — Required Before Real Moroccan Farmer Data

| Task | File | Priority |
|------|------|----------|
| Add `FIELD_AGENT` to Role enum | `prisma/schema.prisma` | P0 |
| Add `country`, `cin`, `province`, `commune`, `cndpConsent`, `cndpConsentAt` to Farmer | `prisma/schema.prisma` | P0 |
| Add `country` to Parcelle and Cooperative | `prisma/schema.prisma` | P0 |
| Add `source` field to WeatherHistory | `prisma/schema.prisma` | P0 |
| Add `NdviHistory` model | `prisma/schema.prisma` | P0 |
| Add Morocco geo reference models | `prisma/schema.prisma` | P0 |
| Add insurance application models | `prisma/schema.prisma` | P0 |
| Add AuditLog model | `prisma/schema.prisma` | P0 |
| Fix timezone in weather jobs to `Africa/Casablanca` | `src/jobs/weatherCollector.ts` | P0 |
| Protect `GET /v1/farmers/:id` with verifyToken | `src/routes/farmers.ts` | P0 |
| Protect `POST /v1/farmers` with verifyToken | `src/routes/farmers.ts` | P0 |
| Mask PII fields in farmer responses | `src/routes/farmers.ts` | P0 |
| Add CNDP consent validation on create/update | `src/routes/farmers.ts` | P0 |
| Add Morocco CORS origins | `src/lib/security.ts` | P0 |
| Guard Sentinel env vars on startup | `src/routes/ndvi.ts` | P0 |
| Open-Meteo archive service | `src/lib/weatherArchive.ts` | P0 |
| Moroccan phone validation | `src/lib/validation.ts` | P0 |
| Morocco reference seed data | `src/seeds/morocco-references.ts` | P0 |
| Morocco insurer institution seed | `src/seeds/morocco-insurer.ts` | P0 |

### P1 — After First Morocco Demo

| Task | File |
|------|------|
| Copernicus NDVI history service | `src/lib/ndviHistory.ts` |
| NDVI history endpoint | `src/routes/ndvi.ts` |
| Weather archive endpoint | `src/routes/weather.ts` |
| Haversine geo utilities | `src/lib/geoUtils.ts` |
| Hydro risk calculation | `src/lib/hydroRisk.ts` |
| RAX/WRS v1 calculation engine | `src/lib/insuranceRax.ts` |
| Insurance application CRUD | `src/routes/insurance/applications.ts` |
| Field audit sync endpoint | `src/routes/insurance/fieldAudit.ts` |
| Mission management | `src/routes/insurance/missions.ts` |
| Insurance pricing generation | `src/lib/insurancePricing.ts` |
| Moroccan crop scoring engine | `src/lib/moroccoScore.ts` |
| SEED_DEMO data labeling | All insurance routes |

### P2 — Production Hardening

| Task |
|------|
| AuditLog write on all sensitive access |
| Solana anchor hash integration |
| Document signed URLs (move to S3/CDN) |
| Strict TypeScript mode |
| Automated test suite (Vitest) |
| Swagger/OpenAPI documentation |
| Redis for verification codes |
| Real cron library (pg-boss or node-cron) |
| Insurance claim management endpoints |
| Settings versioning |
| Analytics/reporting endpoints |

### Exact Env Vars to Add for Phase 27

```env
# Morocco context
MOROCCO_TIMEZONE=Africa/Casablanca
DEFAULT_COUNTRY=MA

# Open-Meteo archive (optional for free tier)
OPEN_METEO_API_KEY=

# Insurance CORS
CORS_ALLOWED_ORIGINS=https://assurance.wakama.farm,https://agent.wakama.farm

# Insurance signing (audit trail)
INSURANCE_AUDIT_SECRET=

# Solana (optional for P1)
SOLANA_RPC_URL=
SOLANA_PROGRAM_ID=
```

### Exact Commands to Run

```bash
# After schema changes
npx prisma generate
npx prisma migrate dev --name add_morocco_insurance_backbone

# Seed reference data
npx tsx src/seeds/morocco-references.ts
npx tsx src/seeds/morocco-insurer.ts

# Verify build
npm run build

# Smoke test
curl https://api.wakama.farm/health
```

### Known Questions Before Coding

1. **Insurer name and country code:** What is the exact name and ID of the Morocco insurer institution?
2. **Pilot farmer details:** Exact GPS for Ksar El-Kébir parcelle (lat/lng), CIN format, commune code?
3. **RAX parameters:** What are the accepted Morocco-specific RAX weighting parameters?
4. **Flood risk source:** Which official Morocco source (ABHS, DRH, Ministère) to cite for flood zones?
5. **CNDP process:** Is there a specific CNDP consent text / reference number required?
6. **Solana program ID:** Is there a deployed Wakama anchor program or is this to be deployed fresh?
7. **Agent App authentication:** Will the Agent App use the same JWT system or a separate mobile credential flow?
8. **Multi-insurer support:** Does Phase 27 need to support more than one insurer, or single-insurer pilot only?

---

## SECTION 15 — Final Audit Verdict

### Backend Readiness Level

```
LOW → MEDIUM
```

The backend is a **functional production API** for Côte d'Ivoire agricultural lending. It is **not ready** for Morocco insurance without significant additions. However, the architecture is sound and the additions are additive — no breaking changes required.

### Can We Safely Build Phase 27 Now?

```
YES WITH PRECONDITIONS
```

**Preconditions required before touching real Moroccan farmer data:**

| # | Precondition | Urgency |
|---|-------------|---------|
| 1 | `GET /v1/farmers/:id` must require auth — currently returns cniUrl/phone publicly | MUST DO FIRST |
| 2 | `POST /v1/farmers` must require auth — currently unprotected | MUST DO FIRST |
| 3 | CNDP consent fields must exist in schema before any real farmer is created | MUST DO FIRST |
| 4 | `FIELD_AGENT` role must be added to enum before Agent App testing | MUST DO FIRST |
| 5 | Morocco CORS origins must be added before dashboard can connect | MUST DO FIRST |
| 6 | Timezone must be fixed from `Africa/Abidjan` to `Africa/Casablanca` | MUST DO FIRST |
| 7 | `country` field must be added and default changed to `"MA"` for Morocco records | MUST DO FIRST |

### Top 10 Blockers

| # | Blocker |
|---|---------|
| 1 | **No FIELD_AGENT role** — Agent App login and mission sync impossible |
| 2 | **No insurance models** — 0 of 17 required insurance models exist |
| 3 | **PII exposure on `GET /v1/farmers/:id`** — cniUrl/phone/attestationUrl returned without auth |
| 4 | **No CNDP consent fields** — legally required for Morocco real data |
| 5 | **No country field on Farmer/Parcelle** — Morocco data indistinguishable from CI data |
| 6 | **No weather archive** — only forecast; insurance pricing needs historical rainfall |
| 7 | **No NDVI history model** — only current snapshot; no time series for indemnification |
| 8 | **No hydro/flood risk data** — no dams, rivers, or flood zones for Loukkos basin |
| 9 | **Timezone hardcoded to Africa/Abidjan** — all Morocco weather records will be 1h off |
| 10 | **No Morocco reference data** — no Moroccan provinces, communes, crops, dams seeded |

### Required Preconditions

All 7 preconditions above must be resolved **before the first real Moroccan farmer is created** in the system.

### Suggested Next Claude Prompt Title

```
PHASE 27 — STEP 1: Morocco Insurance Backbone — Schema + PII Protection + Morocco References
```

This step should:
1. Update `prisma/schema.prisma` with all new models
2. Run `prisma generate` + migration
3. Fix PII exposure on farmer routes
4. Add CNDP consent to farmer creation
5. Seed Morocco reference data (dams, rivers, communes, crops, insurer)
6. Fix timezone and country defaults
7. Add CORS origins for Morocco dashboards

---

*Audit completed: 2026-05-29 — read-only, no files modified, no migrations run.*
