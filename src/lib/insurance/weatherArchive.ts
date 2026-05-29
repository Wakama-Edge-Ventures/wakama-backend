import prisma from '../prisma.js'
import { buildSourceDisclosure } from '../sourceDisclosure.js'
import { validateDateRange, validateLatLng } from './insuranceValidation.js'

export type WeatherArchiveStatus = 'OK' | 'DEGRADED' | 'UNAVAILABLE'

export interface WeatherArchiveDailyRow {
  date: string
  tempMax: number | null
  tempMin: number | null
  precipitation: number | null
  weatherCode: string | null
  provider: string
  source: string
  confidence: string
}

export interface GetWeatherArchiveInput {
  lat: number
  lng: number
  startDate: string
  endDate: string
  provider?: 'OPEN_METEO_ARCHIVE'
  allowLiveFetch?: boolean
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function normalizePoint(value: number): number {
  return Number(value.toFixed(4))
}

function eachDate(start: Date, end: Date): string[] {
  const rows: string[] = []
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))

  while (cursor <= limit) {
    rows.push(isoDate(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return rows
}

async function fetchOpenMeteoArchive(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<WeatherArchiveDailyRow[]> {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=UTC`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Open-Meteo archive fetch failed (${response.status})`)
  }

  const data = await response.json()
  const daily = data.daily
  if (!daily || !Array.isArray(daily.time)) {
    throw new Error('Open-Meteo archive payload missing daily.time')
  }

  return daily.time.map((day: string, index: number) => ({
    date: day,
    tempMax: typeof daily.temperature_2m_max?.[index] === 'number' ? daily.temperature_2m_max[index] : null,
    tempMin: typeof daily.temperature_2m_min?.[index] === 'number' ? daily.temperature_2m_min[index] : null,
    precipitation: typeof daily.precipitation_sum?.[index] === 'number' ? daily.precipitation_sum[index] : null,
    weatherCode:
      daily.weather_code?.[index] !== undefined && daily.weather_code?.[index] !== null
        ? String(daily.weather_code[index])
        : null,
    provider: 'OPEN_METEO_ARCHIVE',
    source: 'LIVE',
    confidence: 'HIGH',
  }))
}

function fromSeedRows(rows: Array<{
  recordedDate: Date
  tempMax: number | null
  tempMin: number | null
  precipitation: number | null
  weatherCode: string | null
  dataProvider: string
  source: string
  confidence: string | null
}>): WeatherArchiveDailyRow[] {
  return rows
    .map((row) => ({
      date: isoDate(row.recordedDate),
      tempMax: row.tempMax ?? null,
      tempMin: row.tempMin ?? null,
      precipitation: row.precipitation ?? null,
      weatherCode: row.weatherCode ?? null,
      provider: row.dataProvider,
      source: row.source,
      confidence: row.confidence ?? 'MEDIUM',
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getWeatherArchiveForPoint(input: GetWeatherArchiveInput) {
  const provider = input.provider ?? 'OPEN_METEO_ARCHIVE'
  const allowLiveFetch = input.allowLiveFetch !== false

  const coords = validateLatLng(input.lat, input.lng)
  if ('error' in coords) {
    return {
      status: 'UNAVAILABLE' as const,
      rows: [] as WeatherArchiveDailyRow[],
      warnings: [coords.error],
      sourceDisclosure: buildSourceDisclosure({
        source: 'UNAVAILABLE',
        provider,
        confidence: 'LOW',
      }),
    }
  }

  const dates = validateDateRange(input.startDate, input.endDate, 366)
  if ('error' in dates) {
    return {
      status: 'UNAVAILABLE' as const,
      rows: [] as WeatherArchiveDailyRow[],
      warnings: [dates.error],
      sourceDisclosure: buildSourceDisclosure({
        source: 'UNAVAILABLE',
        provider,
        confidence: 'LOW',
      }),
    }
  }

  const latKey = normalizePoint(coords.lat)
  const lngKey = normalizePoint(coords.lng)

  const requestedDays = eachDate(dates.startDate, dates.endDate)

  const cachedRows = await prisma.weatherHistorySeed.findMany({
    where: {
      lat: latKey,
      lng: lngKey,
      dataProvider: provider,
      recordedDate: {
        gte: new Date(`${requestedDays[0]}T00:00:00.000Z`),
        lte: new Date(`${requestedDays[requestedDays.length - 1]}T23:59:59.999Z`),
      },
    },
    orderBy: { recordedDate: 'asc' },
  })

  const cachedByDay = new Map(fromSeedRows(cachedRows).map((row) => [row.date, row]))
  const missingDates = requestedDays.filter((day) => !cachedByDay.has(day))
  const warnings: string[] = []

  if (!missingDates.length) {
    const rows = requestedDays.map((day) => cachedByDay.get(day)).filter(Boolean) as WeatherArchiveDailyRow[]
    const first = rows[0]

    return {
      status: 'OK' as const,
      rows,
      warnings,
      sourceDisclosure: buildSourceDisclosure({
        source: first?.source ?? 'SEED_DEMO',
        provider,
        confidence: first?.confidence ?? 'MEDIUM',
      }),
    }
  }

  if (!allowLiveFetch) {
    warnings.push(`Missing ${missingDates.length} day(s) in cache and allowLiveFetch=false`) 

    const rows = requestedDays
      .map((day) => cachedByDay.get(day))
      .filter(Boolean) as WeatherArchiveDailyRow[]

    return {
      status: rows.length ? ('DEGRADED' as const) : ('UNAVAILABLE' as const),
      rows,
      warnings,
      sourceDisclosure: buildSourceDisclosure({
        source: rows[0]?.source ?? 'SEED_DEMO',
        provider,
        confidence: rows[0]?.confidence ?? 'LOW',
      }),
    }
  }

  try {
    const liveRows = await fetchOpenMeteoArchive(latKey, lngKey, requestedDays[0], requestedDays[requestedDays.length - 1])

    const missingDateSet = new Set(missingDates)
    const writes = liveRows
      .filter((row) => missingDateSet.has(row.date))
      .map((row) =>
      prisma.weatherHistorySeed.create({
        data: {
          regionCode: 'MA-UNSPECIFIED',
          lat: latKey,
          lng: lngKey,
          recordedDate: new Date(`${row.date}T00:00:00.000Z`),
          tempMax: row.tempMax,
          tempMin: row.tempMin,
          precipitation: row.precipitation,
          weatherCode: row.weatherCode,
          source: row.source,
          dataProvider: row.provider,
          confidence: row.confidence,
        },
      })
    )

    if (writes.length) {
      await prisma.$transaction(writes)
    }

    const rowsByDay = new Map<string, WeatherArchiveDailyRow>()
    for (const row of liveRows) {
      rowsByDay.set(row.date, row)
    }
    for (const row of cachedByDay.values()) {
      rowsByDay.set(row.date, row)
    }

    const rows = requestedDays.map((day) => rowsByDay.get(day)).filter(Boolean) as WeatherArchiveDailyRow[]

    return {
      status: 'OK' as const,
      rows,
      warnings,
      sourceDisclosure: buildSourceDisclosure({
        source: rows[0]?.source ?? 'LIVE',
        provider,
        confidence: rows[0]?.confidence ?? 'HIGH',
      }),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown weather provider error'
    warnings.push(`Open-Meteo archive unavailable: ${message}`)

    const rows = requestedDays
      .map((day) => cachedByDay.get(day))
      .filter(Boolean) as WeatherArchiveDailyRow[]

    return {
      status: rows.length ? ('DEGRADED' as const) : ('UNAVAILABLE' as const),
      rows,
      warnings,
      sourceDisclosure: buildSourceDisclosure({
        source: rows[0]?.source ?? 'SEED_DEMO',
        provider,
        confidence: rows[0]?.confidence ?? 'LOW',
      }),
    }
  }
}
