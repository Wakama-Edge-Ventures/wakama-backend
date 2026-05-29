# Insurance Data Source Disclosure

## Purpose

This backend exposes insurance and Morocco reference data with transparent provenance metadata.

Each response should include:
- `source`
- `provider` (when applicable)
- `confidence`
- `disclaimerFr`
- `disclaimerEn`

## Source Labels

- `LIVE`: real-time or operational data stream.
- `SEED_DEMO`: demo seed records created for non-production simulation.
- `EXCEL_IMPORT`: imported reference data from spreadsheet source.
- `MANUAL_ESTIMATE`: manually estimated technical data.

## Important Disclaimer

The backend does not treat `SEED_DEMO`, `MANUAL_ESTIMATE`, or `EXCEL_IMPORT` data as official regulatory data.

Wakama is not an insurer and does not:
- issue policies
- decide indemnification
- execute indemnity payments

The insurer remains the decision maker for:
- eligibility
- commercial pricing
- policy issuance
- indemnification outcomes

## Implementation

Helper module:
- `src/lib/sourceDisclosure.ts`

Used in:
- `src/routes/morocco.ts`
- `src/routes/insuranceReferences.ts`
