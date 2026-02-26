import type { Prisma, PrismaClient, PricingRun } from "@prisma/client";
import type {
  JsonObject,
  PricingContext,
  PricingRepository,
  PricingRunRecord,
} from "../../application/pricing/ports/pricing.js";

const asJsonObject = (value: unknown): JsonObject => (value ?? {}) as JsonObject;
const asInputJson = (value: JsonObject): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const toPricingRunRecord = (record: PricingRun): PricingRunRecord => ({
  id: record.id,
  requestId: record.requestId,
  productVersionId: record.productVersionId,
  pricingProgramVersionId: record.pricingProgramVersionId,
  requestJson: asJsonObject(record.requestJson),
  responseJson: asJsonObject(record.responseJson),
  occurredAt: record.occurredAt,
  durationMs: record.durationMs,
  success: record.success,
  failureReason: record.failureReason,
});

export class PrismaPricingRepository implements PricingRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getPricingContextByProductVersionId(productVersionId: string): Promise<PricingContext | null> {
    const productVersion = await this.prisma.productVersion.findUnique({
      where: { id: productVersionId },
      include: {
        snapshot: true,
        pricingProgramVersion: true,
      },
    });

    if (
      !productVersion ||
      productVersion.status !== "ACTIVE" ||
      !productVersion.snapshot ||
      !productVersion.pricingProgramVersion
    ) {
      return null;
    }

    return {
      productVersionId: productVersion.id,
      pricingProgramVersionId: productVersion.pricingProgramVersion.id,
      pricingProgramFileRef: productVersion.pricingProgramVersion.fileRef,
      pricingInputSchema: asJsonObject(productVersion.pricingInputSchema),
      pricingOutputSchema: asJsonObject(productVersion.pricingProgramVersion.outputSchema),
      resolvedSnapshot: asJsonObject(productVersion.snapshot.resolvedSnapshot),
    };
  }

  public async getPricingContextBySnapshotId(snapshotId: string): Promise<PricingContext | null> {
    const snapshot = await this.prisma.productVersionSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        productVersion: {
          include: {
            pricingProgramVersion: true,
          },
        },
      },
    });

    if (
      !snapshot ||
      snapshot.productVersion.status !== "ACTIVE" ||
      !snapshot.productVersion.pricingProgramVersion
    ) {
      return null;
    }

    return {
      productVersionId: snapshot.productVersion.id,
      pricingProgramVersionId: snapshot.productVersion.pricingProgramVersion.id,
      pricingProgramFileRef: snapshot.productVersion.pricingProgramVersion.fileRef,
      pricingInputSchema: asJsonObject(snapshot.productVersion.pricingInputSchema),
      pricingOutputSchema: asJsonObject(snapshot.productVersion.pricingProgramVersion.outputSchema),
      resolvedSnapshot: asJsonObject(snapshot.resolvedSnapshot),
    };
  }

  public async createPricingRun(input: {
    requestId: string;
    productVersionId: string;
    pricingProgramVersionId: string;
    requestJson: JsonObject;
    responseJson: JsonObject;
    durationMs: number;
    success: boolean;
    failureReason: string | null;
  }): Promise<PricingRunRecord> {
    const created = await this.prisma.pricingRun.create({
      data: {
        requestId: input.requestId,
        productVersionId: input.productVersionId,
        pricingProgramVersionId: input.pricingProgramVersionId,
        requestJson: asInputJson(input.requestJson),
        responseJson: asInputJson(input.responseJson),
        durationMs: input.durationMs,
        success: input.success,
        failureReason: input.failureReason,
      },
    });
    return toPricingRunRecord(created);
  }
}
