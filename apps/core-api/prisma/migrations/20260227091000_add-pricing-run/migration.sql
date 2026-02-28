-- AlterTable
ALTER TABLE "PricingRun" DROP COLUMN "failureReason",
ADD COLUMN     "errorSummary" TEXT,
ADD COLUMN     "policyTransactionId" UUID,
ADD COLUMN     "pricingProgramFileHash" TEXT,
ADD COLUMN     "pricingProgramFileRef" TEXT;

-- AlterTable
ALTER TABLE "PolicyTransaction" ADD COLUMN     "ratedAt" TIMESTAMPTZ(6),
ADD COLUMN     "ratingRequestJson" JSONB,
ADD COLUMN     "ratingResponseJson" JSONB;

-- CreateIndex
CREATE INDEX "PricingRun_policyTransactionId_occurredAt_idx" ON "PricingRun"("policyTransactionId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PricingRun" ADD CONSTRAINT "PricingRun_policyTransactionId_fkey" FOREIGN KEY ("policyTransactionId") REFERENCES "PolicyTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

