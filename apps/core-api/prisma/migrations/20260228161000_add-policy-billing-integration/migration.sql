-- CreateEnum
CREATE TYPE "BillingObligationStatus" AS ENUM ('OPEN', 'INVOICED', 'CANCELLED');

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "billingObligationId" UUID;

-- CreateTable
CREATE TABLE "BillingObligation" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "policyTransactionId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "billingAccountId" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "dueDate" TIMESTAMPTZ(6) NOT NULL,
    "status" "BillingObligationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingObligation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingObligation_policyTransactionId_key" ON "BillingObligation"("policyTransactionId");

-- CreateIndex
CREATE INDEX "BillingObligation_policyId_createdAt_idx" ON "BillingObligation"("policyId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingObligation_policyId_status_createdAt_idx" ON "BillingObligation"("policyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingObligation_billingAccountId_createdAt_idx" ON "BillingObligation"("billingAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceLine_billingObligationId_createdAt_idx" ON "InvoiceLine"("billingObligationId", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingObligation" ADD CONSTRAINT "BillingObligation_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_billingObligationId_fkey" FOREIGN KEY ("billingObligationId") REFERENCES "BillingObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
