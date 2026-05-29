import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import xlsx from 'xlsx'
import prisma from '../lib/prisma.js'

type HeaderKey =
  | 'country'
  | 'damName'
  | 'iso3'
  | 'adminUnit'
  | 'nearestCity'
  | 'river'
  | 'majorBasin'
  | 'subBasin'
  | 'capacityMm3'
  | 'lat'
  | 'lng'

interface ParsedRow {
  rowNumber: number
  country: string | null
  damName: string | null
  iso3: string | null
  adminUnit: string | null
  nearestCity: string | null
  river: string | null
  majorBasin: string | null
  subBasin: string | null
  capacityMm3: number | null
  lat: number | null
  lng: number | null
  rawLat: string | null
  rawLng: string | null
}

interface InvalidRowArtifact {
  rowNumber: number
  damName: string | null
  reasons: string[]
  country: string | null
  iso3: string | null
  lat: string | null
  lng: string | null
}

interface MissingCoordArtifact {
  rowNumber: number
  damName: string | null
  country: string | null
  iso3: string | null
  lat: string | null
  lng: string | null
}

interface PreviewArtifact {
  rowNumber: number
  name: string
  basin: string | null
  province: string | null
  commune: string | null
  riverName: string | null
  lat: number
  lng: number
  capacityMm3: number | null
  sourceType: string
  confidence: string
  action: 'create' | 'update' | 'skip-official' | 'no-change'
  reason?: string
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeader(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

function normalizeDamName(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const cleaned = String(value).trim().replace(/\s+/g, '').replace(',', '.')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function findHeaderIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const normalized = (rows[i] ?? []).map(cell => normalizeHeader(cell))
    const hasCountry = normalized.some(c => c === 'country')
    const hasDamName = normalized.some(c => c.includes('nameofdam'))
    const hasLat = normalized.some(c => c.includes('decimaldegreelatitude'))
    const hasLng = normalized.some(c => c.includes('decimaldegreelongitude'))
    if (hasCountry && hasDamName && hasLat && hasLng) return i
  }
  return -1
}

function findColumnIndex(headers: unknown[], key: HeaderKey): number {
  const normalized = headers.map(cell => normalizeHeader(cell))
  const checks: Record<HeaderKey, (value: string) => boolean> = {
    country: value => value === 'country',
    damName: value => value.includes('nameofdam'),
    iso3: value => value.includes('isoalpha3'),
    adminUnit: value => value.includes('administrativeunit'),
    nearestCity: value => value.includes('nearestcity'),
    river: value => value === 'river',
    majorBasin: value => value.includes('majorbasin'),
    subBasin: value => value.includes('subbasin'),
    capacityMm3: value => value.includes('reservoircapacitymillionm3'),
    lat: value => value.includes('decimaldegreelatitude'),
    lng: value => value.includes('decimaldegreelongitude'),
  }

  return normalized.findIndex(checks[key])
}

function isMoroccoRow(row: ParsedRow): boolean {
  const countryNorm = normalizeText(row.country)
  const isoNorm = normalizeText(row.iso3).toUpperCase()
  return countryNorm.includes('morocco') || isoNorm === 'MAR'
}

function isLatInRange(lat: number): boolean {
  return lat >= 27 && lat <= 36.5
}

function isLngInRange(lng: number): boolean {
  return lng >= -13.5 && lng <= -0.5
}

function decimalPrecision(raw: string | null): number {
  if (!raw) return 0
  const text = raw.trim()
  const idxDot = text.indexOf('.')
  const idxComma = text.indexOf(',')
  const idx = idxDot >= 0 ? idxDot : idxComma
  if (idx < 0) return 0
  return Math.max(0, text.length - idx - 1)
}

function isMorePreciseThanExisting(
  existing: { lat: number; lng: number; capacityMm3: number | null },
  incoming: { rawLat: string | null; rawLng: string | null; capacityMm3: number | null }
): boolean {
  const incomingLatPrecision = decimalPrecision(incoming.rawLat)
  const incomingLngPrecision = decimalPrecision(incoming.rawLng)
  const existingLatPrecision = decimalPrecision(String(existing.lat))
  const existingLngPrecision = decimalPrecision(String(existing.lng))

  const betterCoordinatePrecision =
    incomingLatPrecision > existingLatPrecision || incomingLngPrecision > existingLngPrecision
  const addsCapacity = existing.capacityMm3 === null && incoming.capacityMm3 !== null
  const betterCapacity =
    existing.capacityMm3 !== null &&
    incoming.capacityMm3 !== null &&
    Math.abs(incoming.capacityMm3 - existing.capacityMm3) > 0 &&
    incoming.capacityMm3 > existing.capacityMm3

  return betterCoordinatePrecision || addsCapacity || betterCapacity
}

function isOuedElMakhazine(name: string): boolean {
  return normalizeDamName(name) === normalizeDamName('Oued El Makhazine')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const writeMode = args.has('--write')
  const dryRun = !writeMode || args.has('--dry-run')
  const modeLabel = writeMode ? 'WRITE' : 'DRY_RUN'

  const excelPath = path.join(process.cwd(), 'data/morocco/liste-bar-maroc.xlsx')
  const outputDir = path.join(process.cwd(), 'data/morocco')
  const reviewPath = path.join(process.cwd(), 'docs/MOROCCO_DAMS_IMPORT_REVIEW.md')
  const previewPath = path.join(outputDir, 'morocco-dams-imported-preview.json')
  const missingPath = path.join(outputDir, 'morocco-dams-missing-coordinates.json')
  const invalidPath = path.join(outputDir, 'morocco-dams-invalid-rows.json')

  if (!existsSync(excelPath)) {
    throw new Error('Missing file: data/morocco/liste-bar-maroc.xlsx')
  }

  const workbook = xlsx.readFile(excelPath)
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Excel workbook has no sheet')

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  })

  const headerIndex = findHeaderIndex(rows)
  if (headerIndex < 0) {
    throw new Error('Unable to detect Excel header row with required columns')
  }

  const headers = rows[headerIndex] ?? []
  const idxCountry = findColumnIndex(headers, 'country')
  const idxDamName = findColumnIndex(headers, 'damName')
  const idxLat = findColumnIndex(headers, 'lat')
  const idxLng = findColumnIndex(headers, 'lng')

  if (idxCountry < 0 || idxDamName < 0 || idxLat < 0 || idxLng < 0) {
    throw new Error('Missing required columns in detected header row')
  }

  const indexes = {
    country: idxCountry,
    damName: idxDamName,
    iso3: findColumnIndex(headers, 'iso3'),
    adminUnit: findColumnIndex(headers, 'adminUnit'),
    nearestCity: findColumnIndex(headers, 'nearestCity'),
    river: findColumnIndex(headers, 'river'),
    majorBasin: findColumnIndex(headers, 'majorBasin'),
    subBasin: findColumnIndex(headers, 'subBasin'),
    capacityMm3: findColumnIndex(headers, 'capacityMm3'),
    lat: idxLat,
    lng: idxLng,
  }

  const parsedRows: ParsedRow[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const damName = toOptionalString(row[indexes.damName])
    const country = toOptionalString(row[indexes.country])
    const iso3 = indexes.iso3 >= 0 ? toOptionalString(row[indexes.iso3]) : null
    const adminUnit = indexes.adminUnit >= 0 ? toOptionalString(row[indexes.adminUnit]) : null
    const nearestCity = indexes.nearestCity >= 0 ? toOptionalString(row[indexes.nearestCity]) : null
    const river = indexes.river >= 0 ? toOptionalString(row[indexes.river]) : null
    const majorBasin = indexes.majorBasin >= 0 ? toOptionalString(row[indexes.majorBasin]) : null
    const subBasin = indexes.subBasin >= 0 ? toOptionalString(row[indexes.subBasin]) : null
    const capacityRaw = indexes.capacityMm3 >= 0 ? row[indexes.capacityMm3] : null
    const latRaw = toOptionalString(row[indexes.lat])
    const lngRaw = toOptionalString(row[indexes.lng])

    if (!damName && !country && !latRaw && !lngRaw) continue

    parsedRows.push({
      rowNumber: i + 1,
      country,
      damName,
      iso3,
      adminUnit,
      nearestCity,
      river,
      majorBasin,
      subBasin,
      capacityMm3: parseNumber(capacityRaw),
      lat: parseNumber(latRaw),
      lng: parseNumber(lngRaw),
      rawLat: latRaw,
      rawLng: lngRaw,
    })
  }

  const totalRowsRead = parsedRows.length
  const missingCoordinates: MissingCoordArtifact[] = []
  const invalidRows: InvalidRowArtifact[] = []
  const validRows: ParsedRow[] = []
  const duplicateNames = new Set<string>()
  const normalizedNameCount = new Map<string, number>()
  let ouedRow: ParsedRow | null = null

  for (const row of parsedRows) {
    const reasons: string[] = []
    if (!isMoroccoRow(row)) reasons.push('Not Morocco/MAR row')
    if (!row.damName) reasons.push('Missing dam name')

    if (!row.rawLat || !row.rawLng) {
      missingCoordinates.push({
        rowNumber: row.rowNumber,
        damName: row.damName,
        country: row.country,
        iso3: row.iso3,
        lat: row.rawLat,
        lng: row.rawLng,
      })
      continue
    }

    if (row.lat === null || row.lng === null) {
      reasons.push('Latitude/longitude are not numeric')
    } else {
      if (!isLatInRange(row.lat)) reasons.push('Latitude out of Morocco range [27, 36.5]')
      if (!isLngInRange(row.lng)) reasons.push('Longitude out of Morocco range [-13.5, -0.5]')
    }

    if (reasons.length > 0) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        damName: row.damName,
        reasons,
        country: row.country,
        iso3: row.iso3,
        lat: row.rawLat,
        lng: row.rawLng,
      })
      continue
    }

    if (row.damName && isOuedElMakhazine(row.damName)) {
      ouedRow = row
    }

    validRows.push(row)

    const normName = normalizeDamName(row.damName!)
    const nextCount = (normalizedNameCount.get(normName) ?? 0) + 1
    normalizedNameCount.set(normName, nextCount)
    if (nextCount > 1) duplicateNames.add(row.damName!)
  }

  const preview: PreviewArtifact[] = []
  let createdCount = 0
  let updatedCount = 0
  let unchangedCount = 0
  let skippedOfficialCount = 0

  for (const row of validRows) {
    const name = row.damName!
    const basin = row.subBasin ?? row.majorBasin ?? null
    const sourceType = 'EXCEL_IMPORT'
    const mapped = {
      arabicName: null as string | null,
      basin,
      province: row.adminUnit,
      commune: row.nearestCity,
      lat: row.lat!,
      lng: row.lng!,
      capacityMm3: row.capacityMm3,
      riverName: row.river,
      operator: 'UNKNOWN_EXCEL',
      sourceUrl: null as string | null,
      sourceType,
      confidence: 'MEDIUM',
    }

    const existing = await prisma.moroccoDam.findUnique({
      where: { name },
      select: {
        id: true,
        lat: true,
        lng: true,
        capacityMm3: true,
        sourceType: true,
        basin: true,
        province: true,
        commune: true,
        riverName: true,
        operator: true,
        sourceUrl: true,
        confidence: true,
      },
    })

    let action: PreviewArtifact['action'] = 'create'
    let reason = ''

    if (existing) {
      if (existing.sourceType === 'OFFICIAL') {
        action = 'skip-official'
        reason = 'Existing OFFICIAL record is not overwritten'
        skippedOfficialCount++
      } else {
        const changed =
          existing.lat !== mapped.lat ||
          existing.lng !== mapped.lng ||
          existing.capacityMm3 !== mapped.capacityMm3 ||
          existing.basin !== mapped.basin ||
          existing.province !== mapped.province ||
          existing.commune !== mapped.commune ||
          existing.riverName !== mapped.riverName ||
          existing.operator !== mapped.operator ||
          existing.sourceUrl !== mapped.sourceUrl ||
          existing.sourceType !== mapped.sourceType ||
          existing.confidence !== mapped.confidence

        if (!changed) {
          action = 'no-change'
          unchangedCount++
        } else if (
          existing.sourceType === 'MANUAL' ||
          isMorePreciseThanExisting(existing, {
            rawLat: row.rawLat,
            rawLng: row.rawLng,
            capacityMm3: row.capacityMm3,
          })
        ) {
          action = 'update'
          updatedCount++
        } else {
          action = 'no-change'
          reason = 'Existing EXCEL_IMPORT record appears as precise or better'
          unchangedCount++
        }
      }
    } else {
      createdCount++
    }

    if (writeMode && action === 'create') {
      await prisma.moroccoDam.create({
        data: {
          name,
          ...mapped,
        },
      })
    }

    if (writeMode && action === 'update') {
      await prisma.moroccoDam.update({
        where: { name },
        data: mapped,
      })
    }

    preview.push({
      rowNumber: row.rowNumber,
      name,
      basin: mapped.basin,
      province: mapped.province,
      commune: mapped.commune,
      riverName: mapped.riverName,
      lat: mapped.lat,
      lng: mapped.lng,
      capacityMm3: mapped.capacityMm3,
      sourceType: mapped.sourceType,
      confidence: mapped.confidence,
      action,
      ...(reason && { reason }),
    })
  }

  const ouedStatus = ouedRow
    ? {
        found: true,
        rowNumber: ouedRow.rowNumber,
        name: ouedRow.damName,
        commune: ouedRow.nearestCity,
        river: ouedRow.river,
        basin: ouedRow.subBasin ?? ouedRow.majorBasin ?? null,
        lat: ouedRow.lat,
        lng: ouedRow.lng,
        capacityMm3: ouedRow.capacityMm3,
      }
    : {
        found: false,
      }

  await mkdir(outputDir, { recursive: true })
  await writeFile(previewPath, JSON.stringify(preview, null, 2), 'utf-8')
  await writeFile(missingPath, JSON.stringify(missingCoordinates, null, 2), 'utf-8')
  await writeFile(invalidPath, JSON.stringify(invalidRows, null, 2), 'utf-8')

  const duplicateNameList = Array.from(duplicateNames.values()).sort((a, b) => a.localeCompare(b))
  const writeImported = writeMode ? createdCount : 0
  const writeUpdated = writeMode ? updatedCount : 0

  const review = `# Morocco Dams Import Review

Date: ${new Date().toISOString()}
Mode: ${modeLabel}
Excel file: data/morocco/liste-bar-maroc.xlsx
Sheet: ${firstSheetName}

## Summary
- Total rows read: ${totalRowsRead}
- Valid GPS rows: ${validRows.length}
- Skipped rows due to missing GPS: ${missingCoordinates.length}
- Invalid coordinate rows: ${invalidRows.length}
- Duplicate names detected: ${duplicateNameList.length}
- Imported count (write mode): ${writeImported}
- Updated count (write mode): ${writeUpdated}
- Unchanged count: ${unchangedCount}
- Skipped OFFICIAL records: ${skippedOfficialCount}

## Oued El Makhazine Verification
- Found in Excel: ${ouedStatus.found ? 'YES' : 'NO'}
${ouedStatus.found ? `- Row number: ${ouedStatus.rowNumber}
- Name: ${ouedStatus.name}
- Nearest city: ${ouedStatus.commune}
- River: ${ouedStatus.river}
- Basin/Sub-basin: ${ouedStatus.basin}
- Latitude: ${ouedStatus.lat}
- Longitude: ${ouedStatus.lng}
- Capacity (million m3): ${ouedStatus.capacityMm3}` : '- WARNING: Oued El Makhazine not found in source Excel'}

## Duplicate Names
${duplicateNameList.length > 0 ? duplicateNameList.map(name => `- ${name}`).join('\n') : '- None'}

## Notes
- This Excel dataset is not treated as official. It is an imported reference dataset pending official validation.
- Rows without usable coordinates are excluded from active MoroccoDam import.
`

  await writeFile(reviewPath, review, 'utf-8')

  console.log(`Mode: ${modeLabel}`)
  console.log(`Total rows read: ${totalRowsRead}`)
  console.log(`Valid GPS rows: ${validRows.length}`)
  console.log(`Missing GPS rows: ${missingCoordinates.length}`)
  console.log(`Invalid rows: ${invalidRows.length}`)
  console.log(`Duplicate names: ${duplicateNameList.length}`)
  console.log(`Oued El Makhazine found: ${ouedStatus.found ? 'YES' : 'NO'}`)
  console.log(`Would create: ${createdCount}`)
  console.log(`Would update: ${updatedCount}`)
  console.log(`No change: ${unchangedCount}`)
  console.log(`Skip OFFICIAL: ${skippedOfficialCount}`)

  if (!ouedStatus.found) {
    throw new Error('Oued El Makhazine not found in Excel dataset. Dry-run failed intentionally.')
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
