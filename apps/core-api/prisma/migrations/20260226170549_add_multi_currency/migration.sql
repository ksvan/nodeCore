/*
  Warnings:

  - Added the required column `currency` to the `PricingRun` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('SEK', 'DKK', 'EUR', 'GBP', 'USD', 'NOK');

-- AlterTable
ALTER TABLE "PricingRun" ADD COLUMN     "currency" "CurrencyCode";
UPDATE "PricingRun" SET "currency" = 'SEK' WHERE "currency" IS NULL;
ALTER TABLE "PricingRun" ALTER COLUMN "currency" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductVersion" ADD COLUMN     "allowedCurrencies" "CurrencyCode"[] DEFAULT ARRAY['SEK']::"CurrencyCode"[],
ADD COLUMN     "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'SEK';
