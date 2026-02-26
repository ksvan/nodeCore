-- CreateTable
CREATE TABLE "PricingRun" (
    "id" UUID NOT NULL,
    "requestId" TEXT NOT NULL,
    "productVersionId" UUID NOT NULL,
    "pricingProgramVersionId" UUID NOT NULL,
    "requestJson" JSONB NOT NULL,
    "responseJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,

    CONSTRAINT "PricingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingRun_requestId_key" ON "PricingRun"("requestId");

-- CreateIndex
CREATE INDEX "PricingRun_productVersionId_occurredAt_idx" ON "PricingRun"("productVersionId", "occurredAt");

-- CreateIndex
CREATE INDEX "PricingRun_pricingProgramVersionId_occurredAt_idx" ON "PricingRun"("pricingProgramVersionId", "occurredAt");

-- AddForeignKey
ALTER TABLE "PricingRun" ADD CONSTRAINT "PricingRun_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRun" ADD CONSTRAINT "PricingRun_pricingProgramVersionId_fkey" FOREIGN KEY ("pricingProgramVersionId") REFERENCES "PricingProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
