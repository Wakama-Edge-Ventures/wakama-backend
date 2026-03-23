import prisma from '../lib/prisma.js'

async function fetchWeatherForLocation(lat: number, lng: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,cloud_cover,shortwave_radiation,uv_index,evapotranspiration,vapour_pressure_deficit,soil_temperature_0cm,soil_temperature_6cm,soil_temperature_18cm,soil_temperature_54cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm&timezone=Africa%2FAbidjan&forecast_days=1`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather fetch failed')
  const data = await res.json()

  const nowISO = new Date().toISOString().slice(0, 13)
  const idx = data.hourly.time.findIndex((t: string) => t.startsWith(nowISO))
  const i = idx >= 0 ? idx : 0

  return {
    tempAir: data.hourly.temperature_2m[i],
    tempFeels: data.hourly.apparent_temperature[i],
    humidityAir: data.hourly.relative_humidity_2m[i],
    dewPoint: data.hourly.dew_point_2m[i],
    precipitation: data.hourly.precipitation[i],
    precipProb: data.hourly.precipitation_probability[i],
    windSpeed: data.hourly.wind_speed_10m[i],
    windDir: data.hourly.wind_direction_10m[i],
    cloudCover: data.hourly.cloud_cover[i],
    radiation: data.hourly.shortwave_radiation[i],
    uvIndex: data.hourly.uv_index[i],
    et0: data.hourly.evapotranspiration[i],
    vpd: data.hourly.vapour_pressure_deficit[i],
    tempSoil0: data.hourly.soil_temperature_0cm[i],
    tempSoil6: data.hourly.soil_temperature_6cm[i],
    tempSoil18: data.hourly.soil_temperature_18cm[i],
    tempSoil54: data.hourly.soil_temperature_54cm[i],
    soilMoist0: data.hourly.soil_moisture_0_to_1cm[i],
    soilMoist1: data.hourly.soil_moisture_1_to_3cm[i],
    soilMoist3: data.hourly.soil_moisture_3_to_9cm[i],
    soilMoist9: data.hourly.soil_moisture_9_to_27cm[i],
  }
}

export async function collectWeatherForAllParcelles() {
  console.log('[WeatherCollector] Starting collection...')

  const parcelles = await prisma.parcelle.findMany({
    select: { id: true, lat: true, lng: true, farmerId: true },
  })

  let success = 0
  let errors = 0

  for (const parcelle of parcelles) {
    try {
      if (!parcelle.lat || !parcelle.lng) continue

      const weather = await fetchWeatherForLocation(parcelle.lat, parcelle.lng)

      await prisma.weatherHistory.create({
        data: {
          parcelleId: parcelle.id,
          farmerId: parcelle.farmerId,
          lat: parcelle.lat,
          lng: parcelle.lng,
          ...weather,
        },
      })

      success++
      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      console.error(`[WeatherCollector] Error for parcelle ${parcelle.id}:`, err)
      errors++
    }
  }

  console.log(`[WeatherCollector] Done. Success: ${success}, Errors: ${errors}`)
}

export async function collectWeatherForAllCoops() {
  const coops = await prisma.cooperative.findMany({
    select: { id: true, lat: true, lng: true, region: true },
  })

  for (const coop of coops) {
    try {
      if (!coop.lat || !coop.lng) continue
      const weather = await fetchWeatherForLocation(coop.lat, coop.lng)
      await prisma.weatherHistory.create({
        data: {
          coopId: coop.id,
          lat: coop.lat,
          lng: coop.lng,
          region: coop.region ?? '',
          ...weather,
        },
      })
      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      console.error(`[WeatherCollector] Error for coop ${coop.id}:`, err)
    }
  }
}
