import prisma from '../lib/prisma.js'

async function fetchWeatherForLocation(lat: number, lng: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,soil_moisture_0_to_1cm&daily=precipitation_sum,weathercode,temperature_2m_max&timezone=Africa%2FAbidjan&forecast_days=3`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

export async function generateAlertsForAllFarmers() {
  console.log('[AlertsGenerator] Starting...')

  const farmers = await prisma.farmer.findMany({
    include: {
      parcelles: { select: { id: true, name: true, ndvi: true, culture: true } },
    },
  })

  for (const farmer of farmers) {
    try {
      const lat = farmer.lat || 7.69
      const lng = farmer.lng || -5.03

      const weather = await fetchWeatherForLocation(lat, lng)
      if (!weather) continue

      const daily = weather.daily
      const tomorrowPrecip = daily.precipitation_sum[1] ?? 0
      const maxTemp = daily.temperature_2m_max[0] ?? 30

      const nowISO = new Date().toISOString().slice(0, 13)
      const idx = weather.hourly.time.findIndex((t: string) => t.startsWith(nowISO))
      const i = idx >= 0 ? idx : 12
      const soilMoisture = weather.hourly.soil_moisture_0_to_1cm[i] ?? 0.3
      const precipProb = weather.hourly.precipitation_probability[i] ?? 0

      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

      // ALERT 1 — Heavy rain coming
      if (tomorrowPrecip > 20) {
        const exists = await prisma.alert.findFirst({
          where: {
            farmerId: farmer.id,
            type: 'METEO',
            title: '🌧️ Fortes pluies prévues demain',
            createdAt: { gte: sixHoursAgo },
          },
        })
        if (!exists) {
          await prisma.alert.create({
            data: {
              farmerId: farmer.id,
              type: 'METEO',
              severity: 'WARNING',
              title: '🌧️ Fortes pluies prévues demain',
              message: `${tomorrowPrecip.toFixed(0)}mm de pluie prévus demain. Reporter l'épandage d'engrais et les traitements phytosanitaires.`,
            },
          })
        }
      }

      // ALERT 2 — Drought risk
      if (soilMoisture < 0.15 && precipProb < 20) {
        const exists = await prisma.alert.findFirst({
          where: {
            farmerId: farmer.id,
            type: 'METEO',
            title: '🌵 Risque de sécheresse',
            createdAt: { gte: sixHoursAgo },
          },
        })
        if (!exists) {
          await prisma.alert.create({
            data: {
              farmerId: farmer.id,
              type: 'METEO',
              severity: 'CRITICAL',
              title: '🌵 Risque de sécheresse',
              message: `Humidité du sol très faible (${(soilMoisture * 200).toFixed(0)}%). Irrigation urgente recommandée dans les 24h.`,
            },
          })
        }
      }

      // ALERT 3 — Heat stress
      if (maxTemp > 38) {
        const exists = await prisma.alert.findFirst({
          where: {
            farmerId: farmer.id,
            type: 'METEO',
            title: '🌡️ Stress thermique prévu',
            createdAt: { gte: sixHoursAgo },
          },
        })
        if (!exists) {
          await prisma.alert.create({
            data: {
              farmerId: farmer.id,
              type: 'METEO',
              severity: 'WARNING',
              title: '🌡️ Stress thermique prévu',
              message: `Température maximale de ${maxTemp}°C prévue. Arrosez tôt le matin ou en soirée.`,
            },
          })
        }
      }

      // ALERT 4 — NDVI alerts per parcelle
      for (const parcelle of farmer.parcelles) {
        if (parcelle.ndvi !== null && parcelle.ndvi < 0.2) {
          const exists = await prisma.alert.findFirst({
            where: {
              farmerId: farmer.id,
              parcelleId: parcelle.id,
              type: 'NDVI',
              severity: 'CRITICAL',
              createdAt: { gte: sixHoursAgo },
            },
          })
          if (!exists) {
            await prisma.alert.create({
              data: {
                farmerId: farmer.id,
                parcelleId: parcelle.id,
                type: 'NDVI',
                severity: 'CRITICAL',
                title: `🛰️ NDVI critique — ${parcelle.name}`,
                message: `Végétation très faible détectée (NDVI: ${parcelle.ndvi?.toFixed(2)}). Vérifiez l'état de votre parcelle ${parcelle.name} (${parcelle.culture}).`,
              },
            })
          }
        } else if (parcelle.ndvi !== null && parcelle.ndvi < 0.3) {
          const exists = await prisma.alert.findFirst({
            where: {
              farmerId: farmer.id,
              parcelleId: parcelle.id,
              type: 'NDVI',
              severity: 'WARNING',
              createdAt: { gte: sixHoursAgo },
            },
          })
          if (!exists) {
            await prisma.alert.create({
              data: {
                farmerId: farmer.id,
                parcelleId: parcelle.id,
                type: 'NDVI',
                severity: 'WARNING',
                title: `🛰️ NDVI faible — ${parcelle.name}`,
                message: `Végétation modérée détectée (NDVI: ${parcelle.ndvi?.toFixed(2)}). Surveillez l'évolution de votre parcelle ${parcelle.name}.`,
              },
            })
          }
        }
      }

      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`[AlertsGenerator] Error for farmer ${farmer.id}:`, err)
    }
  }

  console.log('[AlertsGenerator] Done.')
}

export async function generateAlertsForCoops() {
  const nodes = await prisma.ioTNode.findMany({
    include: {
      readings: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
    },
  })

  for (const node of nodes) {
    if (!node.cooperativeId || node.readings.length === 0) continue
    const latest = node.readings[0]
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

    if (latest.soilMoisture && latest.soilMoisture < 0.2) {
      const exists = await prisma.alert.findFirst({
        where: {
          coopId: node.cooperativeId,
          type: 'IOT',
          createdAt: { gte: sixHoursAgo },
        },
      })
      if (!exists) {
        await prisma.alert.create({
          data: {
            coopId: node.cooperativeId,
            type: 'IOT',
            severity: 'WARNING',
            title: `📡 Humidité sol faible — ${node.nodeCode}`,
            message: `Le capteur ${node.nodeCode} détecte une humidité sol de ${(latest.soilMoisture * 100).toFixed(0)}%. Vérifiez l'irrigation.`,
          },
        })
      }
    }

    if (latest.temperature && latest.temperature > 38) {
      await prisma.alert.create({
        data: {
          coopId: node.cooperativeId,
          type: 'IOT',
          severity: 'CRITICAL',
          title: `🌡️ Température élevée — ${node.nodeCode}`,
          message: `Température de ${latest.temperature}°C détectée par ${node.nodeCode}. Stress thermique possible.`,
        },
      })
    }
  }
}
