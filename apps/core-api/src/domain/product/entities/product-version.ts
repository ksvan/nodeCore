import {
  assertValidVersion,
  cloneJsonObject,
  createComponentReference,
  type ComponentReference,
  type JsonObject,
} from "../shared/component.js";
import { DomainInvariantError } from "../shared/errors.js";

export type ProductVersionStatus = "draft" | "active";

export interface PricingProgramReference {
  readonly programId: string;
  readonly version: number;
}

export interface ResolvedProductVersionSnapshot {
  readonly policySchema: JsonObject;
  readonly validationRules: ReadonlyArray<JsonObject>;
  readonly pricingInputSchema: JsonObject;
  readonly coverageRefs: ReadonlyArray<ComponentReference>;
  readonly exposureRefs: ReadonlyArray<ComponentReference>;
  readonly ruleRefs: ReadonlyArray<ComponentReference>;
  readonly resolvedAt: Date;
}

export interface ProductVersion {
  readonly productId: string;
  readonly version: number;
  readonly status: ProductVersionStatus;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly coverageRefs: ReadonlyArray<ComponentReference>;
  readonly exposureRefs: ReadonlyArray<ComponentReference>;
  readonly ruleRefs: ReadonlyArray<ComponentReference>;
  readonly pricingProgramRef: PricingProgramReference;
  readonly policySchema: JsonObject;
  readonly exposureSchemas: JsonObject;
  readonly pricingInputSchema: JsonObject;
  readonly resolvedSnapshot: ResolvedProductVersionSnapshot | null;
  readonly createdAt: Date;
  readonly activatedAt: Date | null;
}

interface CreateProductVersionDraftInput {
  readonly productId: string;
  readonly version: number;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly coverageRefs?: ReadonlyArray<ComponentReference>;
  readonly exposureRefs?: ReadonlyArray<ComponentReference>;
  readonly ruleRefs?: ReadonlyArray<ComponentReference>;
  readonly pricingProgramRef: PricingProgramReference;
  readonly policySchema?: JsonObject;
  readonly exposureSchemas?: JsonObject;
  readonly pricingInputSchema?: JsonObject;
  readonly createdAt?: Date;
}

interface ActivateProductVersionInput {
  readonly productVersion: ProductVersion;
  readonly snapshot: ResolvedProductVersionSnapshot;
  readonly activatedAt?: Date;
}

const assertNonEmptyId = (value: string, field: string): void => {
  if (value.trim().length === 0) {
    throw new DomainInvariantError(`${field} must be non-empty`);
  }
};

const assertDraftProductVersionEditable = (status: ProductVersionStatus): void => {
  if (status === "active") {
    throw new DomainInvariantError("active product versions are immutable");
  }
};

const assertEffectiveRange = (effectiveFrom: Date, effectiveTo: Date | null): void => {
  if (effectiveTo && effectiveTo <= effectiveFrom) {
    throw new DomainInvariantError("effectiveTo must be later than effectiveFrom");
  }
};

const assertUniqueComponentRefs = (
  references: ReadonlyArray<ComponentReference>,
  refField: string,
): void => {
  const seen = new Set<string>();

  for (const reference of references) {
    const key = `${reference.componentId}@${reference.version}`;
    if (seen.has(key)) {
      throw new DomainInvariantError(`duplicate reference in ${refField}: ${key}`);
    }
    seen.add(key);
  }
};

const assertSameReferenceSet = (
  expected: ReadonlyArray<ComponentReference>,
  actual: ReadonlyArray<ComponentReference>,
  refField: string,
): void => {
  if (expected.length !== actual.length) {
    throw new DomainInvariantError(`${refField} must match configured component references`);
  }

  const expectedKeys = new Set(expected.map((reference) => `${reference.componentId}@${reference.version}`));

  for (const reference of actual) {
    const key = `${reference.componentId}@${reference.version}`;
    if (!expectedKeys.has(key)) {
      throw new DomainInvariantError(`${refField} must match configured component references`);
    }
  }
};

const assertPricingProgramRef = (pricingProgramRef: PricingProgramReference): void => {
  assertNonEmptyId(pricingProgramRef.programId, "pricingProgramRef.programId");
  assertValidVersion(pricingProgramRef.version);
};

const cloneReferences = (
  references: ReadonlyArray<ComponentReference> | undefined,
): ReadonlyArray<ComponentReference> => {
  return (references ?? []).map((reference) =>
    createComponentReference({
      componentId: reference.componentId,
      version: reference.version,
      configOverrides: reference.configOverrides,
    }),
  );
};

const createEmptyObject = (): JsonObject => ({});

export const createProductVersionDraft = (input: CreateProductVersionDraftInput): ProductVersion => {
  assertNonEmptyId(input.productId, "productId");
  assertValidVersion(input.version);
  assertEffectiveRange(input.effectiveFrom, input.effectiveTo);
  assertPricingProgramRef(input.pricingProgramRef);

  const coverageRefs = cloneReferences(input.coverageRefs);
  const exposureRefs = cloneReferences(input.exposureRefs);
  const ruleRefs = cloneReferences(input.ruleRefs);

  assertUniqueComponentRefs(coverageRefs, "coverageRefs");
  assertUniqueComponentRefs(exposureRefs, "exposureRefs");
  assertUniqueComponentRefs(ruleRefs, "ruleRefs");

  return {
    productId: input.productId,
    version: input.version,
    status: "draft",
    effectiveFrom: new Date(input.effectiveFrom),
    effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    coverageRefs,
    exposureRefs,
    ruleRefs,
    pricingProgramRef: { ...input.pricingProgramRef },
    policySchema: cloneJsonObject(input.policySchema ?? createEmptyObject()),
    exposureSchemas: cloneJsonObject(input.exposureSchemas ?? createEmptyObject()),
    pricingInputSchema: cloneJsonObject(input.pricingInputSchema ?? createEmptyObject()),
    resolvedSnapshot: null,
    createdAt: input.createdAt ?? new Date(),
    activatedAt: null,
  };
};

export const replaceProductVersionReferences = (
  productVersion: ProductVersion,
  refs: {
    coverageRefs: ReadonlyArray<ComponentReference>;
    exposureRefs: ReadonlyArray<ComponentReference>;
    ruleRefs: ReadonlyArray<ComponentReference>;
  },
): ProductVersion => {
  assertDraftProductVersionEditable(productVersion.status);

  const coverageRefs = cloneReferences(refs.coverageRefs);
  const exposureRefs = cloneReferences(refs.exposureRefs);
  const ruleRefs = cloneReferences(refs.ruleRefs);

  assertUniqueComponentRefs(coverageRefs, "coverageRefs");
  assertUniqueComponentRefs(exposureRefs, "exposureRefs");
  assertUniqueComponentRefs(ruleRefs, "ruleRefs");

  return {
    ...productVersion,
    coverageRefs,
    exposureRefs,
    ruleRefs,
  };
};

export const updateProductVersionSchemas = (
  productVersion: ProductVersion,
  schemas: {
    policySchema: JsonObject;
    exposureSchemas: JsonObject;
    pricingInputSchema: JsonObject;
  },
): ProductVersion => {
  assertDraftProductVersionEditable(productVersion.status);

  return {
    ...productVersion,
    policySchema: cloneJsonObject(schemas.policySchema),
    exposureSchemas: cloneJsonObject(schemas.exposureSchemas),
    pricingInputSchema: cloneJsonObject(schemas.pricingInputSchema),
  };
};

export const activateProductVersion = (input: ActivateProductVersionInput): ProductVersion => {
  const { productVersion, snapshot } = input;
  assertDraftProductVersionEditable(productVersion.status);

  const activatedSnapshot: ResolvedProductVersionSnapshot = {
    policySchema: cloneJsonObject(snapshot.policySchema),
    validationRules: snapshot.validationRules.map((rule) => cloneJsonObject(rule)),
    pricingInputSchema: cloneJsonObject(snapshot.pricingInputSchema),
    coverageRefs: cloneReferences(snapshot.coverageRefs),
    exposureRefs: cloneReferences(snapshot.exposureRefs),
    ruleRefs: cloneReferences(snapshot.ruleRefs),
    resolvedAt: new Date(snapshot.resolvedAt),
  };

  assertUniqueComponentRefs(activatedSnapshot.coverageRefs, "snapshot.coverageRefs");
  assertUniqueComponentRefs(activatedSnapshot.exposureRefs, "snapshot.exposureRefs");
  assertUniqueComponentRefs(activatedSnapshot.ruleRefs, "snapshot.ruleRefs");
  assertSameReferenceSet(
    productVersion.coverageRefs,
    activatedSnapshot.coverageRefs,
    "snapshot.coverageRefs",
  );
  assertSameReferenceSet(
    productVersion.exposureRefs,
    activatedSnapshot.exposureRefs,
    "snapshot.exposureRefs",
  );
  assertSameReferenceSet(productVersion.ruleRefs, activatedSnapshot.ruleRefs, "snapshot.ruleRefs");

  return {
    ...productVersion,
    status: "active",
    resolvedSnapshot: activatedSnapshot,
    activatedAt: input.activatedAt ?? new Date(),
  };
};
