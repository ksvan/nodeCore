-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProductVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('COVERAGE', 'EXPOSURE', 'RULE');

-- CreateEnum
CREATE TYPE "ComponentVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "PricingProgramVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProductVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "policySchema" JSONB NOT NULL,
    "exposureSchemas" JSONB NOT NULL,
    "pricingInputSchema" JSONB NOT NULL,
    "pricingProgramVersionId" UUID,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersionSnapshot" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "resolvedSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVersionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" UUID NOT NULL,
    "componentCode" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentVersion" (
    "id" UUID NOT NULL,
    "componentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ComponentVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "schema" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersionComponentRef" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "componentVersionId" UUID NOT NULL,
    "configOverrides" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVersionComponentRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingProgram" (
    "id" UUID NOT NULL,
    "programCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingProgramVersion" (
    "id" UUID NOT NULL,
    "pricingProgramId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PricingProgramVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "fileRef" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_productId_version_key" ON "ProductVersion"("productId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersionSnapshot_productVersionId_key" ON "ProductVersionSnapshot"("productVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Component_componentCode_key" ON "Component"("componentCode");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentVersion_componentId_version_key" ON "ComponentVersion"("componentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersionComponentRef_productVersionId_componentVersio_key" ON "ProductVersionComponentRef"("productVersionId", "componentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingProgram_programCode_key" ON "PricingProgram"("programCode");

-- CreateIndex
CREATE UNIQUE INDEX "PricingProgramVersion_pricingProgramId_version_key" ON "PricingProgramVersion"("pricingProgramId", "version");

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_pricingProgramVersionId_fkey" FOREIGN KEY ("pricingProgramVersionId") REFERENCES "PricingProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersionSnapshot" ADD CONSTRAINT "ProductVersionSnapshot_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentVersion" ADD CONSTRAINT "ComponentVersion_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersionComponentRef" ADD CONSTRAINT "ProductVersionComponentRef_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersionComponentRef" ADD CONSTRAINT "ProductVersionComponentRef_componentVersionId_fkey" FOREIGN KEY ("componentVersionId") REFERENCES "ComponentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingProgramVersion" ADD CONSTRAINT "PricingProgramVersion_pricingProgramId_fkey" FOREIGN KEY ("pricingProgramId") REFERENCES "PricingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
