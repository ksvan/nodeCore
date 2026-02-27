-- CreateEnum
CREATE TYPE "PolicyRiskType" AS ENUM ('VEHICLE', 'PROPERTY', 'LOCATION', 'PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "CoverageTermValueType" AS ENUM ('MONEY', 'NUMBER', 'STRING', 'BOOLEAN');

-- AlterEnum
ALTER TYPE "PolicyStatus" ADD VALUE 'RETIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PolicyTermStatus" ADD VALUE 'DRAFT';
ALTER TYPE "PolicyTermStatus" ADD VALUE 'CLOSED';

-- DropForeignKey
ALTER TABLE "PolicyTransaction" DROP CONSTRAINT "PolicyTransaction_policyTermId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyCoverageRecord" DROP CONSTRAINT "PolicyCoverageRecord_policyId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyCoverageRecord" DROP CONSTRAINT "PolicyCoverageRecord_policyTermId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyCoverageRecord" DROP CONSTRAINT "PolicyCoverageRecord_policyTransactionId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyEditLog" DROP CONSTRAINT "PolicyEditLog_policyId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyExposureRecord" DROP CONSTRAINT "PolicyExposureRecord_policyId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyExposureRecord" DROP CONSTRAINT "PolicyExposureRecord_policyTermId_fkey";

-- DropForeignKey
ALTER TABLE "PolicyExposureRecord" DROP CONSTRAINT "PolicyExposureRecord_policyTransactionId_fkey";

-- DropIndex
DROP INDEX "PolicyTerm_policyId_termNumber_key";

-- DropIndex
DROP INDEX "PolicyTransaction_policyId_transactionNumber_key";

-- AlterTable (with backfill for existing rows)
ALTER TABLE "Policy"
  ADD COLUMN "productId" UUID,
  ADD COLUMN "productVersionId" UUID,
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
  ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6);

UPDATE "Policy"
SET "productId" = COALESCE("productId", '00000000-0000-0000-0000-000000000000'::uuid),
    "productVersionId" = COALESCE("productVersionId", '00000000-0000-0000-0000-000000000000'::uuid);

ALTER TABLE "Policy"
  ALTER COLUMN "productId" SET NOT NULL,
  ALTER COLUMN "productVersionId" SET NOT NULL;

-- AlterTable (preserve historical term dates)
ALTER TABLE "PolicyTerm"
  ADD COLUMN "termStart" TIMESTAMPTZ(6),
  ADD COLUMN "termEnd" TIMESTAMPTZ(6),
  ADD COLUMN "updatedAt" TIMESTAMPTZ(6),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

UPDATE "PolicyTerm"
SET "termStart" = "effectiveFrom",
    "termEnd" = "effectiveTo",
    "updatedAt" = COALESCE("updatedAt", "createdAt");

ALTER TABLE "PolicyTerm"
  ALTER COLUMN "termStart" SET NOT NULL,
  ALTER COLUMN "termEnd" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  DROP COLUMN "effectiveFrom",
  DROP COLUMN "effectiveTo",
  DROP COLUMN "termNumber";

-- AlterTable (preserve transaction references and effective date)
ALTER TABLE "PolicyTransaction"
  ADD COLUMN "effectiveAt" TIMESTAMPTZ(6),
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "termId" UUID,
  ADD COLUMN "type" "PolicyTransactionType",
  ALTER COLUMN "committedAt" SET DATA TYPE TIMESTAMPTZ(6),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

UPDATE "PolicyTransaction"
SET "effectiveAt" = "effectiveFrom",
    "termId" = COALESCE(
      "policyTermId",
      (
        SELECT t."id"
        FROM "PolicyTerm" t
        WHERE t."policyId" = "PolicyTransaction"."policyId"
        ORDER BY t."createdAt" DESC
        LIMIT 1
      )
    ),
    "type" = "transactionType";

ALTER TABLE "PolicyTransaction"
  ALTER COLUMN "effectiveAt" SET NOT NULL,
  ALTER COLUMN "termId" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL,
  DROP COLUMN "draftPayload",
  DROP COLUMN "effectiveFrom",
  DROP COLUMN "effectiveTo",
  DROP COLUMN "policyTermId",
  DROP COLUMN "pricingProgramVersionId",
  DROP COLUMN "productVersionId",
  DROP COLUMN "ratedAt",
  DROP COLUMN "ratingRequestJson",
  DROP COLUMN "ratingResponseJson",
  DROP COLUMN "transactionNumber",
  DROP COLUMN "transactionType";

-- DropTable
DROP TABLE "PolicyCoverageRecord";

-- DropTable
DROP TABLE "PolicyEditLog";

-- DropTable
DROP TABLE "PolicyExposureRecord";

-- CreateTable
CREATE TABLE "PolicyRisk" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "riskType" "PolicyRiskType" NOT NULL,
    "riskKey" TEXT,
    "attributes" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6) NOT NULL,
    "createdByTransactionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyCoverage" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "coverageCode" TEXT NOT NULL,
    "appliesToRiskId" UUID,
    "attributes" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6) NOT NULL,
    "createdByTransactionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageTerm" (
    "id" UUID NOT NULL,
    "policyCoverageId" UUID NOT NULL,
    "termCode" TEXT NOT NULL,
    "valueType" "CoverageTermValueType" NOT NULL,
    "moneyAmount" DECIMAL(18,2),
    "moneyCurrency" CHAR(3),
    "numberValue" DECIMAL(18,4),
    "stringValue" TEXT,
    "booleanValue" BOOLEAN,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6) NOT NULL,
    "createdByTransactionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyPremium" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "coverageId" UUID,
    "riskId" UUID,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "breakdown" JSONB,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6) NOT NULL,
    "createdByTransactionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyPremium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRiskDraft" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "riskType" "PolicyRiskType" NOT NULL,
    "riskKey" TEXT,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyRiskDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyCoverageDraft" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "coverageCode" TEXT NOT NULL,
    "appliesToRiskKey" TEXT,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyCoverageDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageTermDraft" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "policyCoverageDraftId" UUID NOT NULL,
    "termCode" TEXT NOT NULL,
    "valueType" "CoverageTermValueType" NOT NULL,
    "moneyAmount" DECIMAL(18,2),
    "moneyCurrency" CHAR(3),
    "numberValue" DECIMAL(18,4),
    "stringValue" TEXT,
    "booleanValue" BOOLEAN,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageTermDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyIdempotencyKey" (
    "id" UUID NOT NULL,
    "policyId" UUID,
    "commandScope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyRisk_policyId_effectiveFrom_effectiveTo_idx" ON "PolicyRisk"("policyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyRisk_policyId_riskType_effectiveFrom_effectiveTo_idx" ON "PolicyRisk"("policyId", "riskType", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyRisk_policyId_riskKey_effectiveFrom_effectiveTo_idx" ON "PolicyRisk"("policyId", "riskKey", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyCoverage_policyId_effectiveFrom_effectiveTo_idx" ON "PolicyCoverage"("policyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyCoverage_policyId_coverageCode_effectiveFrom_effectiv_idx" ON "PolicyCoverage"("policyId", "coverageCode", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "CoverageTerm_policyCoverageId_effectiveFrom_effectiveTo_idx" ON "CoverageTerm"("policyCoverageId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "CoverageTerm_termCode_effectiveFrom_effectiveTo_idx" ON "CoverageTerm"("termCode", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyPremium_policyId_effectiveFrom_effectiveTo_idx" ON "PolicyPremium"("policyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyRiskDraft_transactionId_createdAt_idx" ON "PolicyRiskDraft"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyCoverageDraft_transactionId_createdAt_idx" ON "PolicyCoverageDraft"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "CoverageTermDraft_transactionId_createdAt_idx" ON "CoverageTermDraft"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyIdempotencyKey_policyId_createdAt_idx" ON "PolicyIdempotencyKey"("policyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyIdempotencyKey_commandScope_idempotencyKey_key" ON "PolicyIdempotencyKey"("commandScope", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Policy_productId_idx" ON "Policy"("productId");

-- CreateIndex
CREATE INDEX "Policy_productVersionId_idx" ON "Policy"("productVersionId");

-- CreateIndex
CREATE INDEX "PolicyTransaction_policyId_createdAt_idx" ON "PolicyTransaction"("policyId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyTransaction_policyId_effectiveAt_idx" ON "PolicyTransaction"("policyId", "effectiveAt");

-- CreateIndex
CREATE INDEX "PolicyTransaction_termId_createdAt_idx" ON "PolicyTransaction"("termId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyTransaction_policyId_idempotencyKey_key" ON "PolicyTransaction"("policyId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyTransaction_policyId_requestId_key" ON "PolicyTransaction"("policyId", "requestId");

-- AddForeignKey
ALTER TABLE "PolicyTransaction" ADD CONSTRAINT "PolicyTransaction_termId_fkey" FOREIGN KEY ("termId") REFERENCES "PolicyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRisk" ADD CONSTRAINT "PolicyRisk_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRisk" ADD CONSTRAINT "PolicyRisk_termId_fkey" FOREIGN KEY ("termId") REFERENCES "PolicyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRisk" ADD CONSTRAINT "PolicyRisk_createdByTransactionId_fkey" FOREIGN KEY ("createdByTransactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverage" ADD CONSTRAINT "PolicyCoverage_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverage" ADD CONSTRAINT "PolicyCoverage_termId_fkey" FOREIGN KEY ("termId") REFERENCES "PolicyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverage" ADD CONSTRAINT "PolicyCoverage_appliesToRiskId_fkey" FOREIGN KEY ("appliesToRiskId") REFERENCES "PolicyRisk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverage" ADD CONSTRAINT "PolicyCoverage_createdByTransactionId_fkey" FOREIGN KEY ("createdByTransactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageTerm" ADD CONSTRAINT "CoverageTerm_policyCoverageId_fkey" FOREIGN KEY ("policyCoverageId") REFERENCES "PolicyCoverage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageTerm" ADD CONSTRAINT "CoverageTerm_createdByTransactionId_fkey" FOREIGN KEY ("createdByTransactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyPremium" ADD CONSTRAINT "PolicyPremium_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyPremium" ADD CONSTRAINT "PolicyPremium_termId_fkey" FOREIGN KEY ("termId") REFERENCES "PolicyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyPremium" ADD CONSTRAINT "PolicyPremium_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "PolicyCoverage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyPremium" ADD CONSTRAINT "PolicyPremium_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "PolicyRisk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyPremium" ADD CONSTRAINT "PolicyPremium_createdByTransactionId_fkey" FOREIGN KEY ("createdByTransactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRiskDraft" ADD CONSTRAINT "PolicyRiskDraft_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRiskDraft" ADD CONSTRAINT "PolicyRiskDraft_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverageDraft" ADD CONSTRAINT "PolicyCoverageDraft_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverageDraft" ADD CONSTRAINT "PolicyCoverageDraft_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageTermDraft" ADD CONSTRAINT "CoverageTermDraft_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageTermDraft" ADD CONSTRAINT "CoverageTermDraft_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageTermDraft" ADD CONSTRAINT "CoverageTermDraft_policyCoverageDraftId_fkey" FOREIGN KEY ("policyCoverageDraftId") REFERENCES "PolicyCoverageDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyIdempotencyKey" ADD CONSTRAINT "PolicyIdempotencyKey_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
