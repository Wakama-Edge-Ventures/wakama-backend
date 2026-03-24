/*
  Warnings:

  - You are about to drop the column `cooperativeId` on the `Alert` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Alert` table. All the data in the column will be lost.
  - You are about to drop the column `lat` on the `Alert` table. All the data in the column will be lost.
  - You are about to drop the column `lng` on the `Alert` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedAt` on the `Alert` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Alert` table. All the data in the column will be lost.
  - Added the required column `message` to the `Alert` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `severity` on the `Alert` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `Alert` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_cooperativeId_fkey";

-- AlterTable
ALTER TABLE "Alert" DROP COLUMN "cooperativeId",
DROP COLUMN "description",
DROP COLUMN "lat",
DROP COLUMN "lng",
DROP COLUMN "resolvedAt",
DROP COLUMN "status",
ADD COLUMN     "coopId" TEXT,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "severity",
ADD COLUMN     "severity" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropEnum
DROP TYPE "AlertSeverity";

-- DropEnum
DROP TYPE "AlertStatus";

-- DropEnum
DROP TYPE "AlertType";

-- CreateIndex
CREATE INDEX "Alert_farmerId_read_idx" ON "Alert"("farmerId", "read");

-- CreateIndex
CREATE INDEX "Alert_coopId_read_idx" ON "Alert"("coopId", "read");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_coopId_fkey" FOREIGN KEY ("coopId") REFERENCES "Cooperative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
