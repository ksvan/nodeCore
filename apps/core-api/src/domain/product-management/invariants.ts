import { ProductManagementDomainError } from "./errors.js";
import type {
  ComponentVersionStatus,
  ProductVersionSnapshotPayload,
  ProductVersionStatus,
  ResolvedComponentSnapshotItem,
} from "./types.js";

const assertNonEmpty = (value: string, field: string): void => {
  if (value.trim().length === 0) {
    throw new ProductManagementDomainError(`${field} must be non-empty`);
  }
};

export const assertEditableProductVersion = (status: ProductVersionStatus): void => {
  if (status !== "DRAFT") {
    throw new ProductManagementDomainError("Only DRAFT product versions can be edited");
  }
};

export const assertActivatableProductVersion = (status: ProductVersionStatus): void => {
  if (status !== "DRAFT") {
    throw new ProductManagementDomainError("Only DRAFT product versions can be activated");
  }
};

export const assertRetirableProductVersion = (status: ProductVersionStatus): void => {
  if (status === "RETIRED") {
    throw new ProductManagementDomainError("Product version is already RETIRED");
  }
};

export const assertActiveComponentVersions = (
  componentStatuses: ReadonlyArray<ComponentVersionStatus>,
): void => {
  const notActive = componentStatuses.find((status) => status !== "ACTIVE");
  if (notActive) {
    throw new ProductManagementDomainError(
      "All referenced component versions must be ACTIVE before activation",
    );
  }
};

export const assertEffectiveRange = (effectiveFrom: Date, effectiveTo: Date | null): void => {
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new ProductManagementDomainError("effectiveTo must be later than effectiveFrom");
  }
};

export const buildProductVersionSnapshotPayload = (input: {
  productVersionId: string;
  productId: string;
  version: number;
  policySchema: Record<string, unknown>;
  exposureSchemas: Record<string, unknown>;
  pricingInputSchema: Record<string, unknown>;
  components: ReadonlyArray<ResolvedComponentSnapshotItem>;
  generatedAt?: Date;
}): ProductVersionSnapshotPayload => {
  assertNonEmpty(input.productVersionId, "productVersionId");
  assertNonEmpty(input.productId, "productId");
  if (!Number.isInteger(input.version) || input.version <= 0) {
    throw new ProductManagementDomainError("version must be a positive integer");
  }

  return {
    productVersionId: input.productVersionId,
    productId: input.productId,
    version: input.version,
    policySchema: structuredClone(input.policySchema),
    exposureSchemas: structuredClone(input.exposureSchemas),
    pricingInputSchema: structuredClone(input.pricingInputSchema),
    components: input.components.map((component) => structuredClone(component)),
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
  };
};
