-- CreateTable
CREATE TABLE "WeatherHistory" (
    "id" TEXT NOT NULL,
    "parcelleId" TEXT,
    "coopId" TEXT,
    "farmerId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CI',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tempAir" DOUBLE PRECISION NOT NULL,
    "tempFeels" DOUBLE PRECISION,
    "tempSoil0" DOUBLE PRECISION,
    "tempSoil6" DOUBLE PRECISION,
    "tempSoil18" DOUBLE PRECISION,
    "tempSoil54" DOUBLE PRECISION,
    "humidityAir" DOUBLE PRECISION,
    "soilMoist0" DOUBLE PRECISION,
    "soilMoist1" DOUBLE PRECISION,
    "soilMoist3" DOUBLE PRECISION,
    "soilMoist9" DOUBLE PRECISION,
    "soilMoist27" DOUBLE PRECISION,
    "precipitation" DOUBLE PRECISION,
    "precipProb" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "windDir" DOUBLE PRECISION,
    "cloudCover" DOUBLE PRECISION,
    "radiation" DOUBLE PRECISION,
    "uvIndex" DOUBLE PRECISION,
    "sunshineDur" DOUBLE PRECISION,
    "et0" DOUBLE PRECISION,
    "vpd" DOUBLE PRECISION,
    "dewPoint" DOUBLE PRECISION,

    CONSTRAINT "WeatherHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherHistory_parcelleId_recordedAt_idx" ON "WeatherHistory"("parcelleId", "recordedAt");

-- CreateIndex
CREATE INDEX "WeatherHistory_coopId_recordedAt_idx" ON "WeatherHistory"("coopId", "recordedAt");

-- CreateIndex
CREATE INDEX "WeatherHistory_farmerId_recordedAt_idx" ON "WeatherHistory"("farmerId", "recordedAt");

-- CreateIndex
CREATE INDEX "WeatherHistory_lat_lng_recordedAt_idx" ON "WeatherHistory"("lat", "lng", "recordedAt");

-- AddForeignKey
ALTER TABLE "WeatherHistory" ADD CONSTRAINT "WeatherHistory_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherHistory" ADD CONSTRAINT "WeatherHistory_coopId_fkey" FOREIGN KEY ("coopId") REFERENCES "Cooperative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherHistory" ADD CONSTRAINT "WeatherHistory_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
