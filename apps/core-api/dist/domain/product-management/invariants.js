import { ProductManagementDomainError } from "./errors.js";
const assertNonEmpty = (value, field) => {
    if (value.trim().length === 0) {
        throw new ProductManagementDomainError(`${field} must be non-empty`);
    }
};
export const assertEditableProductVersion = (status) => {
    if (status !== "DRAFT") {
        throw new ProductManagementDomainError("Only DRAFT product versions can be edited");
    }
};
export const assertActivatableProductVersion = (status) => {
    if (status !== "DRAFT") {
        throw new ProductManagementDomainError("Only DRAFT product versions can be activated");
    }
};
export const assertRetirableProductVersion = (status) => {
    if (status === "RETIRED") {
        throw new ProductManagementDomainError("Product version is already RETIRED");
    }
};
export const assertActiveComponentVersions = (componentStatuses) => {
    const notActive = componentStatuses.find((status) => status !== "ACTIVE");
    if (notActive) {
        throw new ProductManagementDomainError("All referenced component versions must be ACTIVE before activation");
    }
};
export const assertEffectiveRange = (effectiveFrom, effectiveTo) => {
    if (effectiveTo && effectiveTo <= effectiveFrom) {
        throw new ProductManagementDomainError("effectiveTo must be later than effectiveFrom");
    }
};
export const buildProductVersionSnapshotPayload = (input) => {
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
