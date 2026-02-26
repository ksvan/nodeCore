-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- CreateEnum
CREATE TYPE "PolicyTransactionType" AS ENUM ('NEW_BUSINESS', 'ENDORSEMENT');

-- CreateEnum
CREATE TYPE "PolicyTransactionStatus" AS ENUM ('DRAFT', 'COMMITTED');

-- CreateEnum
CREATE TYPE "PolicyTermStatus" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "Policy" (
    "id" UUID NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyTerm" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "termNumber" INTEGER NOT NULL,
    "status" "PolicyTermStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyTransaction" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "policyTermId" UUID,
    "transactionNumber" INTEGER NOT NULL,
    "transactionType" "PolicyTransactionType" NOT NULL,
    "status" "PolicyTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "productVersionId" UUID NOT NULL,
    "pricingProgramVersionId" UUID,
    "draftPayload" JSONB NOT NULL,
    "ratingRequestJson" JSONB,
    "ratingResponseJson" JSONB,
    "ratedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyExposureRecord" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "policyTermId" UUID NOT NULL,
    "policyTransactionId" UUID NOT NULL,
    "exposureKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyExposureRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyCoverageRecord" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "policyTermId" UUID NOT NULL,
    "policyTransactionId" UUID NOT NULL,
    "coverageKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyCoverageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Policy_policyNumber_key" ON "Policy"("policyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyTerm_policyId_termNumber_key" ON "PolicyTerm"("policyId", "termNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyTransaction_policyId_transactionNumber_key" ON "PolicyTransaction"("policyId", "transactionNumber");

-- CreateIndex
CREATE INDEX "PolicyExposureRecord_policyId_effectiveFrom_effectiveTo_idx" ON "PolicyExposureRecord"("policyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyExposureRecord_policyId_exposureKey_effectiveFrom_eff_idx" ON "PolicyExposureRecord"("policyId", "exposureKey", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyCoverageRecord_policyId_effectiveFrom_effectiveTo_idx" ON "PolicyCoverageRecord"("policyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "PolicyCoverageRecord_policyId_coverageKey_effectiveFrom_eff_idx" ON "PolicyCoverageRecord"("policyId", "coverageKey", "effectiveFrom", "effectiveTo");

-- AddForeignKey
ALTER TABLE "PolicyTerm" ADD CONSTRAINT "PolicyTerm_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyTransaction" ADD CONSTRAINT "PolicyTransaction_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyTransaction" ADD CONSTRAINT "PolicyTransaction_policyTermId_fkey" FOREIGN KEY ("policyTermId") REFERENCES "PolicyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyExposureRecord" ADD CONSTRAINT "PolicyExposureRecord_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyExposureRecord" ADD CONSTRAINT "PolicyExposureRecord_policyTermId_fkey" FOREIGN KEY ("policyTermId") REFERENCES "PolicyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyExposureRecord" ADD CONSTRAINT "PolicyExposureRecord_policyTransactionId_fkey" FOREIGN KEY ("policyTransactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverageRecord" ADD CONSTRAINT "PolicyCoverageRecord_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverageRecord" ADD CONSTRAINT "PolicyCoverageRecord_policyTermId_fkey" FOREIGN KEY ("policyTermId") REFERENCES "PolicyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCoverageRecord" ADD CONSTRAINT "PolicyCoverageRecord_policyTransactionId_fkey" FOREIGN KEY ("policyTransactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
