# Security P0 Notes

## CORS

- Default allowlist:
  - `https://wakama.farm`
  - `https://www.wakama.farm`
  - `https://farmer.wakama.farm`
  - `https://fmi.wakama.farm`
  - `https://oracle.wakama.farm`
  - `https://api.wakama.farm`
  - `http://localhost:3000`
  - `http://localhost:3001`
  - `http://localhost:3002`
  - `http://localhost:3003`
  - `http://localhost:4000`
  - `http://127.0.0.1:3000`
  - `http://127.0.0.1:3001`
  - `http://127.0.0.1:3002`
  - `http://127.0.0.1:3003`
  - `http://127.0.0.1:4000`
- Optional env: `CORS_ALLOWED_ORIGINS`
  - Comma-separated list
  - Values are added to the default allowlist
- Requests without `Origin` stay allowed for server-side clients, IoT clients, and `curl`

## Rate Limit

- Optional env:
  - `RATE_LIMIT_MAX`
  - `RATE_LIMIT_WINDOW`
  - `AUTH_RATE_LIMIT_MAX`
  - `UPLOAD_RATE_LIMIT_MAX`
  - `IOT_RATE_LIMIT_MAX`
- Default behavior:
  - Global API limit by IP
  - Stricter limit on auth endpoints
  - Stricter limit on upload endpoints
  - Higher limit on `/v1/iot/ingest`

## Protected Mutations

- `POST /v1/cooperatives`
- `PATCH /v1/cooperatives/:id`
- `PATCH /v1/farmers/:id`
- `POST /v1/parcelles`
- `PATCH /v1/parcelles/:id`
- `DELETE /v1/parcelles/:id`
- `POST /v1/credit-requests`
- `PATCH /v1/credit-requests/:id/approve`
- `PATCH /v1/credit-requests/:id/reject`
- `POST /v1/institutions`
- `POST /v1/institutions/:id/decisions`
- `PATCH /v1/institutions/decisions/:id`
- `PATCH /v1/institutions/:id/scoring-config`
- `POST /v1/activities`
- `POST /v1/messages`
- `PATCH /v1/alerts/:id/read`
- `PATCH /v1/alerts/read-all`
- `POST /v1/iot-kit-requests`
- `POST /v1/upload/farmer/:farmerId/photo`
- `POST /v1/upload/farmer/:farmerId/document`
- `POST /v1/upload/cooperative/:coopId/logo`

## Uploads

- Optional env: `UPLOAD_MAX_BYTES`
- Default max file size: `5242880` bytes
- Allowed extensions: `jpg`, `jpeg`, `png`, `webp`, `pdf`
- Allowed MIME:
  - Farmer/cooperative images: `image/jpeg`, `image/png`, `image/webp`
  - Farmer documents: image MIME above plus `application/pdf`

## Protected GET Endpoints (Bearer obligatoire)

- `GET /v1/farmers/:id/dossier-comite` — tenant-aware ; READONLY autorise en lecture

## Still Public By Design

- `GET /v1/farmers`
- `GET /v1/farmers/:id`
- `GET /v1/parcelles`
- `GET /v1/cooperatives`
- `GET /v1/cooperatives/:id`
- `GET /v1/credit-requests`
- `GET /v1/institutions/:id/scoring-config`
- `/uploads/*` static assets (sauf cni/attestation bloques par hook global)

## Optional Tenant-Aware Reads

- If a valid `Authorization: Bearer ...` token is present:
  - `GET /v1/farmers` narrows to the caller tenant when possible
  - `GET /v1/cooperatives` narrows to the caller tenant when possible
  - `GET /v1/credit-requests` narrows to the caller tenant when possible
- If no token is sent, current public compatibility behavior stays in place
- Institution users only see farmers/coops/credit requests linked to their `institutionId`
- Unassigned farmers are not exposed to institution users through the tenant-aware filters

## IoT Transition

- `POST /v1/iot/ingest` keeps the current `X-Device-Key` contract unchanged
- Env support now exists via `IOT_DEVICE_KEYS`
  - Format: comma-separated `deviceKey:coopId` pairs
- Legacy fallback keys remain temporarily active for compatibility
- Recommended next step: rotate device keys into env-only configuration and remove fallback keys once the station fleet is updated

## Frontend Vigilance

- Farmer App and FMI Dashboard should send `Authorization: Bearer ...` on every protected mutation
- Farmer App and FMI Dashboard should also send Bearer on `GET /v1/farmers`, `GET /v1/cooperatives`, and `GET /v1/credit-requests` to benefit from tenant-aware narrowing
- Without Bearer on those GET endpoints, legacy public behavior is intentionally preserved for now

## Next Recommended Step

- Confirm Bearer propagation end-to-end in Farmer App and FMI Dashboard, then progressively remove legacy public read behavior on sensitive list endpoints and continue tenant isolation on the remaining GET routes.
