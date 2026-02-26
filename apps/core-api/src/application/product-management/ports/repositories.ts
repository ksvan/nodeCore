import type {
  ComponentType,
  ComponentVersionStatus,
  JsonObject,
  PricingProgramVersionStatus,
  ProductStatus,
  ProductVersionStatus,
} from "../../../domain/product-management/index.js";

export interface ProductRecord {
  readonly id: string;
  readonly productCode: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductVersionRecord {
  readonly id: string;
  readonly productId: string;
  readonly version: number;
  readonly status: ProductVersionStatus;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly policySchema: JsonObject;
  readonly exposureSchemas: JsonObject;
  readonly pricingInputSchema: JsonObject;
  readonly defaultCurrency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
  readonly allowedCurrencies: ReadonlyArray<"SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK">;
  readonly pricingProgramVersionId: string | null;
  readonly activatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductVersionSnapshotRecord {
  readonly id: string;
  readonly productVersionId: string;
  readonly resolvedSnapshot: JsonObject;
  readonly createdAt: Date;
}

export interface ComponentRecord {
  readonly id: string;
  readonly componentCode: string;
  readonly type: ComponentType;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ComponentVersionRecord {
  readonly id: string;
  readonly componentId: string;
  readonly version: number;
  readonly status: ComponentVersionStatus;
  readonly schema: JsonObject;
  readonly metadata: JsonObject;
  readonly releasedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly component: ComponentRecord;
}

export interface ProductVersionComponentRefRecord {
  readonly id: string;
  readonly productVersionId: string;
  readonly componentVersionId: string;
  readonly configOverrides: JsonObject;
  readonly createdAt: Date;
  readonly componentVersion: ComponentVersionRecord;
}

export interface PricingProgramRecord {
  readonly id: string;
  readonly programCode: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PricingProgramVersionRecord {
  readonly id: string;
  readonly pricingProgramId: string;
  readonly version: number;
  readonly status: PricingProgramVersionStatus;
  readonly fileRef: string;
  readonly inputSchema: JsonObject;
  readonly outputSchema: JsonObject;
  readonly metadata: JsonObject;
  readonly releasedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly pricingProgram: PricingProgramRecord;
}

export interface ProductManagementRepository {
  createProduct(input: {
    productCode: string;
    name: string;
    description: string | null;
    status: ProductStatus;
  }): Promise<ProductRecord>;
  listProducts(): Promise<ReadonlyArray<ProductRecord>>;
  getProductById(productId: string): Promise<ProductRecord | null>;
  updateProduct(
    productId: string,
    patch: Partial<Pick<ProductRecord, "name" | "description" | "status">>,
  ): Promise<ProductRecord | null>;
  deleteProduct(productId: string): Promise<boolean>;

  createProductVersion(input: {
    productId: string;
    version: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    policySchema: JsonObject;
    exposureSchemas: JsonObject;
    pricingInputSchema: JsonObject;
    defaultCurrency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    allowedCurrencies: ReadonlyArray<"SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK">;
    pricingProgramVersionId: string | null;
  }): Promise<ProductVersionRecord>;
  getProductVersionById(productVersionId: string): Promise<ProductVersionRecord | null>;
  getNextProductVersionNumber(productId: string): Promise<number>;
  updateProductVersionStatus(
    productVersionId: string,
    status: ProductVersionStatus,
    activatedAt?: Date,
  ): Promise<ProductVersionRecord>;

  addProductVersionComponentRef(input: {
    productVersionId: string;
    componentVersionId: string;
    configOverrides: JsonObject;
  }): Promise<ProductVersionComponentRefRecord>;
  removeProductVersionComponentRef(
    productVersionId: string,
    componentVersionId: string,
  ): Promise<boolean>;
  listProductVersionComponentRefs(
    productVersionId: string,
  ): Promise<ReadonlyArray<ProductVersionComponentRefRecord>>;

  createProductVersionSnapshot(input: {
    productVersionId: string;
    resolvedSnapshot: JsonObject;
  }): Promise<ProductVersionSnapshotRecord>;
  getProductVersionSnapshot(
    productVersionId: string,
  ): Promise<ProductVersionSnapshotRecord | null>;

  createComponent(input: {
    componentCode: string;
    type: ComponentType;
    name: string;
    description: string | null;
  }): Promise<ComponentRecord>;
  listComponents(type?: ComponentType): Promise<ReadonlyArray<ComponentRecord>>;
  getComponentById(componentId: string): Promise<ComponentRecord | null>;

  createComponentVersion(input: {
    componentId: string;
    version: number;
    status: ComponentVersionStatus;
    schema: JsonObject;
    metadata: JsonObject;
    releasedAt: Date | null;
  }): Promise<ComponentVersionRecord>;
  getNextComponentVersionNumber(componentId: string): Promise<number>;
  getComponentVersionById(componentVersionId: string): Promise<ComponentVersionRecord | null>;
  getComponentVersionByCompositeKey(
    componentId: string,
    version: number,
  ): Promise<ComponentVersionRecord | null>;

  createPricingProgram(input: {
    programCode: string;
    name: string;
    description: string | null;
  }): Promise<PricingProgramRecord>;
  getPricingProgramById(pricingProgramId: string): Promise<PricingProgramRecord | null>;
  createPricingProgramVersion(input: {
    pricingProgramId: string;
    version: number;
    status: PricingProgramVersionStatus;
    fileRef: string;
    inputSchema: JsonObject;
    outputSchema: JsonObject;
    metadata: JsonObject;
    releasedAt: Date | null;
  }): Promise<PricingProgramVersionRecord>;
  getNextPricingProgramVersionNumber(pricingProgramId: string): Promise<number>;
  getPricingProgramVersionById(
    pricingProgramVersionId: string,
  ): Promise<PricingProgramVersionRecord | null>;
}

export interface DomainEventPublisher {
  publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}
