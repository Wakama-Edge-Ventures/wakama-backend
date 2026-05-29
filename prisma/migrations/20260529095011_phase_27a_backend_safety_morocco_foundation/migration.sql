-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'INSTITUTION_ADMIN';
ALTER TYPE "Role" ADD VALUE 'FIELD_AGENT';

-- AlterTable
ALTER TABLE "Cooperative" ADD COLUMN     "commune" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'CI',
ADD COLUMN     "iceOrRc" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "province" TEXT;

-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN     "cin" TEXT,
ADD COLUMN     "cndpConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cndpConsentAt" TIMESTAMP(3),
ADD COLUMN     "cndpConsentVersion" TEXT,
ADD COLUMN     "commune" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'CI',
ADD COLUMN     "dateNaissance" TIMESTAMP(3),
ADD COLUMN     "experienceAnnees" TEXT,
ADD COLUMN     "historicCredit" TEXT,
ADD COLUMN     "moroccoPhoneNormalized" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "revenusAnnexes" TEXT,
ADD COLUMN     "sexe" TEXT;

-- AlterTable
ALTER TABLE "Parcelle" ADD COLUMN     "commune" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'CI',
ADD COLUMN     "elevationM" DOUBLE PRECISION,
ADD COLUMN     "hydroRiskJson" TEXT,
ADD COLUMN     "hydroRiskLevel" TEXT,
ADD COLUMN     "hydroRiskScore" DOUBLE PRECISION,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "slopePct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WeatherHistory" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'FORECAST';

-- CreateTable
CREATE TABLE "IotKitRequest" (
    "id" TEXT NOT NULL,
    "coopId" TEXT,
    "coopName" TEXT NOT NULL,
    "superficie" DOUBLE PRECISION,
    "culture" TEXT,
    "nbMembres" INTEGER,
    "hasElectricite" BOOLEAN NOT NULL DEFAULT false,
    "hasConnexion" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IotKitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRequest" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "coopId" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "duree" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "message" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "montantAccorde" DOUBLE PRECISION,
    "taux" DOUBLE PRECISION,
    "dureeAccordee" INTEGER,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CI',
    "logo" TEXT,
    "modules" TEXT[],
    "plan" TEXT NOT NULL DEFAULT 'STANDARD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ANALYST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDecision" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION,
    "taux" DOUBLE PRECISION,
    "duree" INTEGER,
    "statut" TEXT NOT NULL,
    "motif" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionScoringConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "weightC1" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "weightC2" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "weightC3" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "weightC4" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "c1Rules" JSONB,
    "c2Rules" JSONB,
    "c3Rules" JSONB,
    "c4Rules" JSONB,
    "products" JSONB,
    "creditConditions" JSONB,
    "riskProfile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionScoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NdviHistory" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT,
    "parcelleId" TEXT,
    "regionCode" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "ndviValue" DOUBLE PRECISION NOT NULL,
    "capturedWeek" INTEGER NOT NULL,
    "capturedYear" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'LIVE',
    "provider" TEXT NOT NULL DEFAULT 'COPERNICUS',
    "rawJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NdviHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoProvince" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoProvince_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoCommune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoCommune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoDam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "arabicName" TEXT,
    "basin" TEXT,
    "province" TEXT,
    "commune" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "capacityMm3" DOUBLE PRECISION,
    "riverName" TEXT,
    "operator" TEXT,
    "sourceUrl" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoDam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoRiverSegment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basin" TEXT,
    "geometryGeojson" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoRiverSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoroccoFloodRiskZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT,
    "commune" TEXT,
    "basin" TEXT,
    "geometryGeojson" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "reason" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoroccoFloodRiskZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceCropCategory" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "code" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelAr" TEXT,
    "family" TEXT,
    "defaultRiskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCropCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "oldValueJson" TEXT,
    "newValueJson" TEXT,
    "ipAddress" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceApplication" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "parcelleId" TEXT,
    "insurerInstitutionId" TEXT,
    "country" TEXT NOT NULL DEFAULT 'MA',
    "province" TEXT,
    "commune" TEXT,
    "cropType" TEXT NOT NULL,
    "cropVariety" TEXT,
    "declaredSurfaceHa" DOUBLE PRECISION NOT NULL,
    "declaredLat" DOUBLE PRECISION,
    "declaredLng" DOUBLE PRECISION,
    "cndpConsentChecked" BOOLEAN NOT NULL DEFAULT false,
    "cndpConsentTimestamp" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceMission" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "assignedAgentUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "requiredKyc" BOOLEAN NOT NULL DEFAULT true,
    "requiredGpsPolygon" BOOLEAN NOT NULL DEFAULT true,
    "surfaceTolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "auditEquipment" BOOLEAN NOT NULL DEFAULT false,
    "auditBuildings" BOOLEAN NOT NULL DEFAULT false,
    "auditStocks" BOOLEAN NOT NULL DEFAULT false,
    "auditLivestock" BOOLEAN NOT NULL DEFAULT false,
    "requirePhotos" BOOLEAN NOT NULL DEFAULT true,
    "requireSignature" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceFieldAudit" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "missionId" TEXT,
    "agentUserId" TEXT,
    "measuredSurfaceHa" DOUBLE PRECISION,
    "measuredPolygonGeojson" TEXT,
    "gpsAccuracyM" DOUBLE PRECISION,
    "photosJson" TEXT,
    "assetsJson" TEXT,
    "agentComment" TEXT,
    "localPayloadHash" TEXT,
    "serverPayloadHash" TEXT,
    "hashStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'LIVE',
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceFieldAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionUser_userId_institutionId_key" ON "InstitutionUser"("userId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionScoringConfig_institutionId_key" ON "InstitutionScoringConfig"("institutionId");

-- CreateIndex
CREATE INDEX "NdviHistory_parcelleId_idx" ON "NdviHistory"("parcelleId");

-- CreateIndex
CREATE INDEX "NdviHistory_capturedYear_capturedWeek_idx" ON "NdviHistory"("capturedYear", "capturedWeek");

-- CreateIndex
CREATE INDEX "NdviHistory_regionCode_idx" ON "NdviHistory"("regionCode");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoProvince_name_key" ON "MoroccoProvince"("name");

-- CreateIndex
CREATE INDEX "MoroccoCommune_provinceId_idx" ON "MoroccoCommune"("provinceId");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoCommune_provinceId_name_key" ON "MoroccoCommune"("provinceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoDam_name_key" ON "MoroccoDam"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoRiverSegment_name_key" ON "MoroccoRiverSegment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MoroccoFloodRiskZone_name_key" ON "MoroccoFloodRiskZone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCropCategory_country_code_key" ON "InsuranceCropCategory"("country", "code");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "InsuranceApplication_farmerId_idx" ON "InsuranceApplication"("farmerId");

-- CreateIndex
CREATE INDEX "InsuranceApplication_parcelleId_idx" ON "InsuranceApplication"("parcelleId");

-- CreateIndex
CREATE INDEX "InsuranceApplication_insurerInstitutionId_idx" ON "InsuranceApplication"("insurerInstitutionId");

-- CreateIndex
CREATE INDEX "InsuranceApplication_status_idx" ON "InsuranceApplication"("status");

-- CreateIndex
CREATE INDEX "InsuranceMission_applicationId_idx" ON "InsuranceMission"("applicationId");

-- CreateIndex
CREATE INDEX "InsuranceMission_assignedAgentUserId_idx" ON "InsuranceMission"("assignedAgentUserId");

-- CreateIndex
CREATE INDEX "InsuranceMission_status_idx" ON "InsuranceMission"("status");

-- CreateIndex
CREATE INDEX "InsuranceFieldAudit_applicationId_idx" ON "InsuranceFieldAudit"("applicationId");

-- CreateIndex
CREATE INDEX "InsuranceFieldAudit_missionId_idx" ON "InsuranceFieldAudit"("missionId");

-- CreateIndex
CREATE INDEX "InsuranceFieldAudit_agentUserId_idx" ON "InsuranceFieldAudit"("agentUserId");

-- CreateIndex
CREATE INDEX "InsuranceFieldAudit_hashStatus_idx" ON "InsuranceFieldAudit"("hashStatus");

-- AddForeignKey
ALTER TABLE "Cooperative" ADD CONSTRAINT "Cooperative_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecision" ADD CONSTRAINT "CreditDecision_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecision" ADD CONSTRAINT "CreditDecision_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionScoringConfig" ADD CONSTRAINT "InstitutionScoringConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdviHistory" ADD CONSTRAINT "NdviHistory_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdviHistory" ADD CONSTRAINT "NdviHistory_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoroccoCommune" ADD CONSTRAINT "MoroccoCommune_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "MoroccoProvince"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceApplication" ADD CONSTRAINT "InsuranceApplication_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceApplication" ADD CONSTRAINT "InsuranceApplication_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceApplication" ADD CONSTRAINT "InsuranceApplication_insurerInstitutionId_fkey" FOREIGN KEY ("insurerInstitutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceMission" ADD CONSTRAINT "InsuranceMission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InsuranceApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceMission" ADD CONSTRAINT "InsuranceMission_assignedAgentUserId_fkey" FOREIGN KEY ("assignedAgentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceFieldAudit" ADD CONSTRAINT "InsuranceFieldAudit_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InsuranceApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceFieldAudit" ADD CONSTRAINT "InsuranceFieldAudit_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "InsuranceMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceFieldAudit" ADD CONSTRAINT "InsuranceFieldAudit_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
