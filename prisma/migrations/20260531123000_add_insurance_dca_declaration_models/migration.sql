-- CreateTable
CREATE TABLE "InsuranceDcaDeclaration" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "parcelleId" TEXT,
    "consentCndp" BOOLEAN NOT NULL,
    "preferredLanguage" TEXT,
    "periodYears" INTEGER NOT NULL,
    "noClaimsDeclared" BOOLEAN NOT NULL,
    "sourceLabel" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "identitySnapshot" JSONB,
    "parcelleSnapshot" JSONB,
    "rawDeclaration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceDcaDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceDcaPreparedDocument" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "sourceLabel" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "ocrText" TEXT,
    "ocrMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceDcaPreparedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceDcaClaimEvent" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "crop" TEXT,
    "estimatedLossMad" INTEGER,
    "comment" TEXT,
    "sourceLabel" TEXT NOT NULL DEFAULT 'MANUAL_ESTIMATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceDcaClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceDcaDeclaration_applicationId_key" ON "InsuranceDcaDeclaration"("applicationId");

-- CreateIndex
CREATE INDEX "InsuranceDcaDeclaration_farmerId_idx" ON "InsuranceDcaDeclaration"("farmerId");

-- CreateIndex
CREATE INDEX "InsuranceDcaDeclaration_parcelleId_idx" ON "InsuranceDcaDeclaration"("parcelleId");

-- CreateIndex
CREATE INDEX "InsuranceDcaPreparedDocument_declarationId_idx" ON "InsuranceDcaPreparedDocument"("declarationId");

-- CreateIndex
CREATE INDEX "InsuranceDcaClaimEvent_declarationId_idx" ON "InsuranceDcaClaimEvent"("declarationId");

-- CreateIndex
CREATE INDEX "InsuranceDcaClaimEvent_year_idx" ON "InsuranceDcaClaimEvent"("year");

-- AddForeignKey
ALTER TABLE "InsuranceDcaDeclaration" ADD CONSTRAINT "InsuranceDcaDeclaration_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InsuranceApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDcaDeclaration" ADD CONSTRAINT "InsuranceDcaDeclaration_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDcaDeclaration" ADD CONSTRAINT "InsuranceDcaDeclaration_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDcaPreparedDocument" ADD CONSTRAINT "InsuranceDcaPreparedDocument_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "InsuranceDcaDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceDcaClaimEvent" ADD CONSTRAINT "InsuranceDcaClaimEvent_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "InsuranceDcaDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
