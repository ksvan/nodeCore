export type ProductStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type ProductVersionStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type ComponentType = "COVERAGE" | "EXPOSURE" | "RULE";
export type ComponentVersionStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type PricingProgramVersionStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export type JsonObject = Record<string, unknown>;

export interface ResolvedComponentSnapshotItem {
  readonly componentId: string;
  readonly componentVersionId: string;
  readonly componentType: ComponentType;
  readonly version: number;
  readonly schema: JsonObject;
  readonly metadata: JsonObject;
  readonly configOverrides: JsonObject;
}

export interface ProductVersionSnapshotPayload {
  readonly productVersionId: string;
  readonly productId: string;
  readonly version: number;
  readonly policySchema: JsonObject;
  readonly exposureSchemas: JsonObject;
  readonly pricingInputSchema: JsonObject;
  readonly components: ReadonlyArray<ResolvedComponentSnapshotItem>;
  readonly generatedAt: string;
}
