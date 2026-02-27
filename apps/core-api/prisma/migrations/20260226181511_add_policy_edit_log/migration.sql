-- CreateTable
CREATE TABLE "PolicyEditLog" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "editType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyEditLog_policyId_createdAt_idx" ON "PolicyEditLog"("policyId", "createdAt");

-- AddForeignKey
ALTER TABLE "PolicyEditLog" ADD CONSTRAINT "PolicyEditLog_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
