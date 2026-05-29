/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `MoroccoProvince` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "MoroccoCommune" DROP CONSTRAINT "MoroccoCommune_provinceId_fkey";

-- AlterTable
ALTER TABLE "InsuranceCropCategory" ADD COLUMN     "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "cropFamily" TEXT,
ADD COLUMN     "defaultRaxFrequency" INTEGER,
ADD COLUMN     "defaultRaxGravity" INTEGER,
ADD COLUMN     "droughtSensitivity" TEXT,
ADD COLUMN     "floodSensitivity" TEXT,
ADD COLUMN     "frostSensitivity" TEXT,
ADD COLUMN     "hailSensitivity" TEXT,
ADD COLUMN     "ndviThresholdCritical" DOUBLE PRECISION,
ADD COLUMN     "ndviThresholdLow" DOUBLE PRECISION,
ADD COLUMN     "pestSensitivity" TEXT,
ADD COLUMN     "riskProfileJson" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE';

-- AlterTable
ALTER TABLE "MoroccoCommune" ADD COLUMN     "code" TEXT,
ADD COLUMN     "confidence" TEXT DEFAULT 'MEDIUM',
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'MA',
ADD COLUMN     "nameAr" TEXT,
ADD COLUMN     "nameFr" TEXT,
ADD COLUMN     "regionCode" TEXT,
ALTER COLUMN "provinceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MoroccoDam" ADD COLUMN     "communeCode" TEXT,
ADD COLUMN     "provinceCode" TEXT,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "riskNotes" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "MoroccoFloodRiskZone" ADD COLUMN     "communeCode" TEXT,
ADD COLUMN     "provinceCode" TEXT,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "riskNotes" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "MoroccoProvince" ADD COLUMN     "code" TEXT,
ADD COLUMN     "confidence" TEXT DEFAULT 'MEDIUM',
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'MA',
ADD COLUMN     "nameAr" TEXT,
ADD COLUMN     "nameFr" TEXT,
ADD COLUMN     "regionId" TEXT;

-- AlterTable
ALTER TABLE "MoroccoRiverSegment" ADD COLUMN     "communeCode" TEXT,
ADD COLUMN     "provinceCode" TEXT,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "riskNotes" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "NdviHistory" ADD COLUMN     "confidence" TEXT,
ADD COLUMN     "dataProvider" TEXT NOT NULL DEFAULT 'COPERNICUS';

-- CreateTable
CREATE TABLE "MoroccoCity" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT,
    "provinceId" TEXT,
    "communeId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "population" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoRegion" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "code" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoCropSeason" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "cropCode" TEXT NOT NULL,
    "cropLabelFr" TEXT NOT NULL,
    "regionCode" TEXT,
    "agroZoneCode" TEXT,
    "sowingStartMonth" INTEGER,
    "sowingEndMonth" INTEGER,
    "harvestStartMonth" INTEGER,
    "harvestEndMonth" INTEGER,
    "irrigationWindowJson" TEXT,
    "riskWindowJson" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoCropSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoAgroClimaticZone" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "code" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "regionCode" TEXT,
    "rainfallBand" TEXT,
    "dominantCropsJson" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoAgroClimaticZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoRiskZone" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "code" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "regionCode" TEXT,
    "provinceCode" TEXT,
    "communeCode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION,
    "geometryJson" TEXT,
    "severityDefault" INTEGER,
    "frequencyDefault" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoRiskZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "category" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelAr" TEXT,
    "description" TEXT,
    "defaultGravity" INTEGER,
    "defaultFrequency" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "insurerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VulnerabilityCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "category" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelAr" TEXT,
    "description" TEXT,
    "defaultWeight" DOUBLE PRECISION,
    "defaultDetectionScore" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "insurerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VulnerabilityCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskMatrixScenario" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "threatCode" TEXT NOT NULL,
    "vulnerabilityCode" TEXT NOT NULL,
    "cropCode" TEXT,
    "regionCode" TEXT,
    "baseGravity" INTEGER NOT NULL,
    "baseFrequency" INTEGER NOT NULL,
    "baseDetection" INTEGER NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskMatrixScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaxParameterSet" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "gravityScaleJson" TEXT NOT NULL,
    "frequencyScaleJson" TEXT NOT NULL,
    "detectionScaleJson" TEXT NOT NULL,
    "tierRulesJson" TEXT NOT NULL,
    "formula" TEXT NOT NULL DEFAULT 'RAX_BRUT=G*F*D;WRS=(RAX_BRUT/25)*100',
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaxParameterSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceRaxEvaluation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "farmerId" TEXT,
    "parcelleId" TEXT,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "gravityScore" DOUBLE PRECISION NOT NULL,
    "frequencyScore" DOUBLE PRECISION NOT NULL,
    "detectionScore" DOUBLE PRECISION NOT NULL,
    "raxBrut" DOUBLE PRECISION NOT NULL,
    "wrs" DOUBLE PRECISION NOT NULL,
    "riskTier" TEXT NOT NULL,
    "explanationJson" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "algorithmVersion" TEXT NOT NULL DEFAULT 'RAX_V1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceRaxEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaimCause" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "code" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelAr" TEXT,
    "category" TEXT NOT NULL,
    "parametricEligible" BOOLEAN NOT NULL DEFAULT false,
    "defaultSeverity" INTEGER,
    "requiredEvidenceJson" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaimCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaimStatusCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaimStatusCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceAlertThreshold" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "code" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "valueMin" DOUBLE PRECISION,
    "valueMax" DOUBLE PRECISION,
    "durationDays" INTEGER,
    "cropCode" TEXT,
    "regionCode" TEXT,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceAlertThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePricingParameterSet" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "cropCode" TEXT,
    "regionCode" TEXT,
    "baseRatePercent" DOUBLE PRECISION,
    "minPremium" DOUBLE PRECISION,
    "maxCoverageRatio" DOUBLE PRECISION,
    "deductibleRulesJson" TEXT,
    "wrsLoadingRulesJson" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurancePricingParameterSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceTaxFeeParameterSet" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "taxRatePercent" DOUBLE PRECISION,
    "wakamaServiceFeePercent" DOUBLE PRECISION,
    "insurerFeePercent" DOUBLE PRECISION,
    "brokerFeePercent" DOUBLE PRECISION,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceTaxFeeParameterSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherHistorySeed" (
    "id" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "recordedDate" TIMESTAMP(3) NOT NULL,
    "tempMax" DOUBLE PRECISION,
    "tempMin" DOUBLE PRECISION,
    "precipitation" DOUBLE PRECISION,
    "weatherCode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "dataProvider" TEXT NOT NULL DEFAULT 'OPEN_METEO_ARCHIVE',
    "confidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherHistorySeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "certificationLevel" TEXT NOT NULL DEFAULT 'LEVEL_1',
    "certifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "zoneProvinces" JSONB,
    "totalMissionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "avgCompletionTimeMin" DOUBLE PRECISION,
    "deviceModel" TEXT,
    "deviceOs" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileKind" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256Hash" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageUrl" TEXT,
    "ipfsCid" TEXT,
    "pinataId" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceBundle" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SEED_DEMO',
    "status" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainAnchor" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'SOLANA',
    "cluster" TEXT NOT NULL DEFAULT 'devnet',
    "payloadHash" TEXT NOT NULL,
    "txSignature" TEXT,
    "explorerUrl" TEXT,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "anchoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnchorQueue" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnchorQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoroccoCity_provinceId_idx" ON "MoroccoCity"("provinceId");

-- CreateIndex
CREATE INDEX "MoroccoCity_communeId_idx" ON "MoroccoCity"("communeId");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoCity_country_nameFr_provinceId_communeId_key" ON "MoroccoCity"("country", "nameFr", "provinceId", "communeId");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoRegion_code_key" ON "MoroccoRegion"("code");

-- CreateIndex
CREATE INDEX "MoroccoCropSeason_country_cropCode_idx" ON "MoroccoCropSeason"("country", "cropCode");

-- CreateIndex
CREATE INDEX "MoroccoCropSeason_regionCode_idx" ON "MoroccoCropSeason"("regionCode");

-- CreateIndex
CREATE INDEX "MoroccoCropSeason_agroZoneCode_idx" ON "MoroccoCropSeason"("agroZoneCode");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoAgroClimaticZone_code_key" ON "MoroccoAgroClimaticZone"("code");

-- CreateIndex
CREATE INDEX "MoroccoAgroClimaticZone_regionCode_idx" ON "MoroccoAgroClimaticZone"("regionCode");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoRiskZone_code_key" ON "MoroccoRiskZone"("code");

-- CreateIndex
CREATE INDEX "MoroccoRiskZone_riskType_idx" ON "MoroccoRiskZone"("riskType");

-- CreateIndex
CREATE INDEX "MoroccoRiskZone_regionCode_provinceCode_communeCode_idx" ON "MoroccoRiskZone"("regionCode", "provinceCode", "communeCode");

-- CreateIndex
CREATE UNIQUE INDEX "ThreatCatalog_code_key" ON "ThreatCatalog"("code");

-- CreateIndex
CREATE INDEX "ThreatCatalog_country_isActive_idx" ON "ThreatCatalog"("country", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "VulnerabilityCatalog_code_key" ON "VulnerabilityCatalog"("code");

-- CreateIndex
CREATE INDEX "VulnerabilityCatalog_country_isActive_idx" ON "VulnerabilityCatalog"("country", "isActive");

-- CreateIndex
CREATE INDEX "RiskMatrixScenario_country_isActive_idx" ON "RiskMatrixScenario"("country", "isActive");

-- CreateIndex
CREATE INDEX "RiskMatrixScenario_threatCode_vulnerabilityCode_idx" ON "RiskMatrixScenario"("threatCode", "vulnerabilityCode");

-- CreateIndex
CREATE INDEX "RaxParameterSet_country_isActive_idx" ON "RaxParameterSet"("country", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RaxParameterSet_country_name_version_key" ON "RaxParameterSet"("country", "name", "version");

-- CreateIndex
CREATE INDEX "InsuranceRaxEvaluation_applicationId_idx" ON "InsuranceRaxEvaluation"("applicationId");

-- CreateIndex
CREATE INDEX "InsuranceRaxEvaluation_farmerId_idx" ON "InsuranceRaxEvaluation"("farmerId");

-- CreateIndex
CREATE INDEX "InsuranceRaxEvaluation_parcelleId_idx" ON "InsuranceRaxEvaluation"("parcelleId");

-- CreateIndex
CREATE INDEX "InsuranceRaxEvaluation_country_riskTier_idx" ON "InsuranceRaxEvaluation"("country", "riskTier");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaimCause_code_key" ON "InsuranceClaimCause"("code");

-- CreateIndex
CREATE INDEX "InsuranceClaimCause_country_active_idx" ON "InsuranceClaimCause"("country", "active");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaimStatusCatalog_code_key" ON "InsuranceClaimStatusCatalog"("code");

-- CreateIndex
CREATE INDEX "InsuranceClaimStatusCatalog_active_sortOrder_idx" ON "InsuranceClaimStatusCatalog"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceAlertThreshold_code_key" ON "InsuranceAlertThreshold"("code");

-- CreateIndex
CREATE INDEX "InsuranceAlertThreshold_country_active_severity_idx" ON "InsuranceAlertThreshold"("country", "active", "severity");

-- CreateIndex
CREATE INDEX "InsuranceAlertThreshold_metric_operator_idx" ON "InsuranceAlertThreshold"("metric", "operator");

-- CreateIndex
CREATE INDEX "InsurancePricingParameterSet_country_isActive_idx" ON "InsurancePricingParameterSet"("country", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InsurancePricingParameterSet_country_name_version_key" ON "InsurancePricingParameterSet"("country", "name", "version");

-- CreateIndex
CREATE INDEX "InsuranceTaxFeeParameterSet_country_isActive_idx" ON "InsuranceTaxFeeParameterSet"("country", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceTaxFeeParameterSet_country_name_version_key" ON "InsuranceTaxFeeParameterSet"("country", "name", "version");

-- CreateIndex
CREATE INDEX "WeatherHistorySeed_regionCode_recordedDate_idx" ON "WeatherHistorySeed"("regionCode", "recordedDate");

-- CreateIndex
CREATE INDEX "WeatherHistorySeed_lat_lng_recordedDate_idx" ON "WeatherHistorySeed"("lat", "lng", "recordedDate");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE INDEX "AgentProfile_isActive_idx" ON "AgentProfile"("isActive");

-- CreateIndex
CREATE INDEX "EvidenceFile_entityType_entityId_idx" ON "EvidenceFile"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EvidenceFile_uploadedByUserId_idx" ON "EvidenceFile"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "EvidenceFile_sha256Hash_idx" ON "EvidenceFile"("sha256Hash");

-- CreateIndex
CREATE INDEX "EvidenceFile_ipfsCid_idx" ON "EvidenceFile"("ipfsCid");

-- CreateIndex
CREATE INDEX "EvidenceBundle_entityType_entityId_idx" ON "EvidenceBundle"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EvidenceBundle_status_idx" ON "EvidenceBundle"("status");

-- CreateIndex
CREATE INDEX "EvidenceBundle_bundleHash_idx" ON "EvidenceBundle"("bundleHash");

-- CreateIndex
CREATE INDEX "BlockchainAnchor_bundleId_idx" ON "BlockchainAnchor"("bundleId");

-- CreateIndex
CREATE INDEX "BlockchainAnchor_entityType_entityId_idx" ON "BlockchainAnchor"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BlockchainAnchor_status_idx" ON "BlockchainAnchor"("status");

-- CreateIndex
CREATE INDEX "AnchorQueue_bundleId_idx" ON "AnchorQueue"("bundleId");

-- CreateIndex
CREATE INDEX "AnchorQueue_status_nextRetryAt_idx" ON "AnchorQueue"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "AnchorQueue_entityType_entityId_idx" ON "AnchorQueue"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MoroccoCommune_regionCode_idx" ON "MoroccoCommune"("regionCode");

-- CreateIndex
CREATE INDEX "MoroccoDam_regionCode_idx" ON "MoroccoDam"("regionCode");

-- CreateIndex
CREATE INDEX "MoroccoDam_provinceCode_idx" ON "MoroccoDam"("provinceCode");

-- CreateIndex
CREATE INDEX "MoroccoDam_communeCode_idx" ON "MoroccoDam"("communeCode");

-- CreateIndex
CREATE INDEX "MoroccoFloodRiskZone_regionCode_idx" ON "MoroccoFloodRiskZone"("regionCode");

-- CreateIndex
CREATE INDEX "MoroccoFloodRiskZone_provinceCode_idx" ON "MoroccoFloodRiskZone"("provinceCode");

-- CreateIndex
CREATE INDEX "MoroccoFloodRiskZone_communeCode_idx" ON "MoroccoFloodRiskZone"("communeCode");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoProvince_code_key" ON "MoroccoProvince"("code");

-- CreateIndex
CREATE INDEX "MoroccoProvince_regionId_idx" ON "MoroccoProvince"("regionId");

-- CreateIndex
CREATE INDEX "MoroccoRiverSegment_regionCode_idx" ON "MoroccoRiverSegment"("regionCode");

-- CreateIndex
CREATE INDEX "MoroccoRiverSegment_provinceCode_idx" ON "MoroccoRiverSegment"("provinceCode");

-- CreateIndex
CREATE INDEX "MoroccoRiverSegment_communeCode_idx" ON "MoroccoRiverSegment"("communeCode");

-- AddForeignKey
ALTER TABLE "MoroccoProvince" ADD CONSTRAINT "MoroccoProvince_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "MoroccoRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoroccoCommune" ADD CONSTRAINT "MoroccoCommune_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "MoroccoProvince"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoroccoCity" ADD CONSTRAINT "MoroccoCity_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "MoroccoProvince"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoroccoCity" ADD CONSTRAINT "MoroccoCity_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "MoroccoCommune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceRaxEvaluation" ADD CONSTRAINT "InsuranceRaxEvaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InsuranceApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceRaxEvaluation" ADD CONSTRAINT "InsuranceRaxEvaluation_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceRaxEvaluation" ADD CONSTRAINT "InsuranceRaxEvaluation_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceBundle" ADD CONSTRAINT "EvidenceBundle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainAnchor" ADD CONSTRAINT "BlockchainAnchor_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "EvidenceBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnchorQueue" ADD CONSTRAINT "AnchorQueue_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "EvidenceBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
