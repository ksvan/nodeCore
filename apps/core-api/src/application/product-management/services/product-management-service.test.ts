import { randomUUID } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { ProductManagementService } from "./product-management-service.js";
import type {
  ComponentRecord,
  ComponentVersionRecord,
  DomainEventPublisher,
  PricingProgramRecord,
  PricingProgramVersionRecord,
  ProductManagementRepository,
  ProductRecord,
  ProductVersionComponentRefRecord,
  ProductVersionRecord,
  ProductVersionSnapshotRecord,
} from "../ports/repositories.js";
import { ProductManagementDomainError } from "../../../domain/product-management/errors.js";
import type {
  ComponentType,
  ComponentVersionStatus,
  JsonObject,
  PricingProgramVersionStatus,
  ProductStatus,
  ProductVersionStatus,
} from "../../../domain/product-management/index.js";

class InMemoryEventPublisher implements DomainEventPublisher {
  public readonly events: Array<{ eventType: string; entityId: string; data: JsonObject }> = [];

  public async publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: JsonObject;
  }): Promise<void> {
    this.events.push({ eventType: input.eventType, entityId: input.entityId, data: input.data });
  }
}

class InMemoryProductManagementRepository implements ProductManagementRepository {
  private readonly products = new Map<string, ProductRecord>();
  private readonly productVersions = new Map<string, ProductVersionRecord>();
  private readonly componentVersions = new Map<string, ComponentVersionRecord>();
  private readonly components = new Map<string, ComponentRecord>();
  private readonly refs = new Map<string, ProductVersionComponentRefRecord>();
  private readonly snapshots = new Map<string, ProductVersionSnapshotRecord>();
  private readonly pricingPrograms = new Map<string, PricingProgramRecord>();
  private readonly pricingProgramVersions = new Map<string, PricingProgramVersionRecord>();

  public async createProduct(input: {
    productCode: string;
    name: string;
    description: string | null;
    status: ProductStatus;
  }): Promise<ProductRecord> {
    const now = new Date();
    const product: ProductRecord = {
      id: randomUUID(),
      productCode: input.productCode,
      name: input.name,
      description: input.description,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(product.id, product);
    return product;
  }

  public async listProducts(): Promise<ReadonlyArray<ProductRecord>> {
    return [...this.products.values()];
  }

  public async getProductById(productId: string): Promise<ProductRecord | null> {
    return this.products.get(productId) ?? null;
  }

  public async updateProduct(
    productId: string,
    patch: Partial<Pick<ProductRecord, "name" | "description" | "status">>,
  ): Promise<ProductRecord | null> {
    const existing = this.products.get(productId);
    if (!existing) {
      return null;
    }
    const updated: ProductRecord = { ...existing, ...patch, updatedAt: new Date() };
    this.products.set(productId, updated);
    return updated;
  }

  public async deleteProduct(productId: string): Promise<boolean> {
    return this.products.delete(productId);
  }

  public async createProductVersion(input: {
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
  }): Promise<ProductVersionRecord> {
    const now = new Date();
    const productVersion: ProductVersionRecord = {
      id: randomUUID(),
      productId: input.productId,
      version: input.version,
      status: "DRAFT",
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      policySchema: input.policySchema,
      exposureSchemas: input.exposureSchemas,
      pricingInputSchema: input.pricingInputSchema,
      defaultCurrency: input.defaultCurrency,
      allowedCurrencies: [...input.allowedCurrencies],
      pricingProgramVersionId: input.pricingProgramVersionId,
      activatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.productVersions.set(productVersion.id, productVersion);
    return productVersion;
  }

  public async getProductVersionById(productVersionId: string): Promise<ProductVersionRecord | null> {
    return this.productVersions.get(productVersionId) ?? null;
  }

  public async listProductVersionsByProductId(
    productId: string,
  ): Promise<ReadonlyArray<ProductVersionRecord>> {
    return [...this.productVersions.values()].filter((row) => row.productId === productId);
  }

  public async getNextProductVersionNumber(productId: string): Promise<number> {
    const versions = [...this.productVersions.values()].filter((version) => version.productId === productId);
    const latest = versions.reduce((max, item) => Math.max(max, item.version), 0);
    return latest + 1;
  }

  public async updateProductVersionStatus(
    productVersionId: string,
    status: ProductVersionStatus,
    activatedAt?: Date,
  ): Promise<ProductVersionRecord> {
    const existing = this.productVersions.get(productVersionId);
    if (!existing) {
      throw new Error("not found");
    }
    const updated: ProductVersionRecord = {
      ...existing,
      status,
      activatedAt: activatedAt ?? existing.activatedAt,
      updatedAt: new Date(),
    };
    this.productVersions.set(productVersionId, updated);
    return updated;
  }

  public async addProductVersionComponentRef(input: {
    productVersionId: string;
    componentVersionId: string;
    configOverrides: JsonObject;
  }): Promise<ProductVersionComponentRefRecord> {
    const componentVersion = this.componentVersions.get(input.componentVersionId);
    if (!componentVersion) {
      throw new Error("component version not found");
    }

    const ref: ProductVersionComponentRefRecord = {
      id: randomUUID(),
      productVersionId: input.productVersionId,
      componentVersionId: input.componentVersionId,
      configOverrides: input.configOverrides,
      createdAt: new Date(),
      componentVersion,
    };
    this.refs.set(ref.id, ref);
    return ref;
  }

  public async removeProductVersionComponentRef(
    productVersionId: string,
    componentVersionId: string,
  ): Promise<boolean> {
    const entry = [...this.refs.entries()].find(
      ([, value]) =>
        value.productVersionId === productVersionId && value.componentVersionId === componentVersionId,
    );
    if (!entry) {
      return false;
    }
    this.refs.delete(entry[0]);
    return true;
  }

  public async listProductVersionComponentRefs(
    productVersionId: string,
  ): Promise<ReadonlyArray<ProductVersionComponentRefRecord>> {
    return [...this.refs.values()].filter((ref) => ref.productVersionId === productVersionId);
  }

  public async createProductVersionSnapshot(input: {
    productVersionId: string;
    resolvedSnapshot: JsonObject;
  }): Promise<ProductVersionSnapshotRecord> {
    const snapshot: ProductVersionSnapshotRecord = {
      id: randomUUID(),
      productVersionId: input.productVersionId,
      resolvedSnapshot: input.resolvedSnapshot,
      createdAt: new Date(),
    };
    this.snapshots.set(input.productVersionId, snapshot);
    return snapshot;
  }

  public async getProductVersionSnapshot(
    productVersionId: string,
  ): Promise<ProductVersionSnapshotRecord | null> {
    return this.snapshots.get(productVersionId) ?? null;
  }

  public async createComponent(input: {
    componentCode: string;
    type: ComponentType;
    name: string;
    description: string | null;
  }): Promise<ComponentRecord> {
    const now = new Date();
    const component: ComponentRecord = {
      id: randomUUID(),
      componentCode: input.componentCode,
      type: input.type,
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    this.components.set(component.id, component);
    return component;
  }

  public async listComponents(type?: ComponentType): Promise<ReadonlyArray<ComponentRecord>> {
    const all = [...this.components.values()];
    return type ? all.filter((component) => component.type === type) : all;
  }

  public async getComponentById(componentId: string): Promise<ComponentRecord | null> {
    return this.components.get(componentId) ?? null;
  }

  public async listComponentVersionsByComponentId(
    componentId: string,
  ): Promise<ReadonlyArray<ComponentVersionRecord>> {
    return [...this.componentVersions.values()].filter((row) => row.componentId === componentId);
  }

  public async createComponentVersion(input: {
    componentId: string;
    version: number;
    status: ComponentVersionStatus;
    schema: JsonObject;
    metadata: JsonObject;
    releasedAt: Date | null;
  }): Promise<ComponentVersionRecord> {
    const component = this.components.get(input.componentId);
    if (!component) {
      throw new Error("component not found");
    }

    const now = new Date();
    const componentVersion: ComponentVersionRecord = {
      id: randomUUID(),
      componentId: input.componentId,
      version: input.version,
      status: input.status,
      schema: input.schema,
      metadata: input.metadata,
      releasedAt: input.releasedAt,
      createdAt: now,
      updatedAt: now,
      component,
    };
    this.componentVersions.set(componentVersion.id, componentVersion);
    return componentVersion;
  }

  public async getNextComponentVersionNumber(componentId: string): Promise<number> {
    const versions = [...this.componentVersions.values()].filter((item) => item.componentId === componentId);
    const latest = versions.reduce((max, item) => Math.max(max, item.version), 0);
    return latest + 1;
  }

  public async getComponentVersionById(
    componentVersionId: string,
  ): Promise<ComponentVersionRecord | null> {
    return this.componentVersions.get(componentVersionId) ?? null;
  }

  public async getComponentVersionByCompositeKey(
    componentId: string,
    version: number,
  ): Promise<ComponentVersionRecord | null> {
    return (
      [...this.componentVersions.values()].find(
        (item) => item.componentId === componentId && item.version === version,
      ) ?? null
    );
  }

  public async createPricingProgram(input: {
    programCode: string;
    name: string;
    description: string | null;
  }): Promise<PricingProgramRecord> {
    const now = new Date();
    const program: PricingProgramRecord = {
      id: randomUUID(),
      programCode: input.programCode,
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    this.pricingPrograms.set(program.id, program);
    return program;
  }

  public async listPricingPrograms(): Promise<ReadonlyArray<PricingProgramRecord>> {
    return [...this.pricingPrograms.values()];
  }

  public async getPricingProgramById(pricingProgramId: string): Promise<PricingProgramRecord | null> {
    return this.pricingPrograms.get(pricingProgramId) ?? null;
  }

  public async createPricingProgramVersion(input: {
    pricingProgramId: string;
    version: number;
    status: PricingProgramVersionStatus;
    fileRef: string;
    inputSchema: JsonObject;
    outputSchema: JsonObject;
    metadata: JsonObject;
    releasedAt: Date | null;
  }): Promise<PricingProgramVersionRecord> {
    const pricingProgram = this.pricingPrograms.get(input.pricingProgramId);
    if (!pricingProgram) {
      throw new Error("pricing program not found");
    }
    const now = new Date();
    const version: PricingProgramVersionRecord = {
      id: randomUUID(),
      pricingProgramId: input.pricingProgramId,
      version: input.version,
      status: input.status,
      fileRef: input.fileRef,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      metadata: input.metadata,
      releasedAt: input.releasedAt,
      createdAt: now,
      updatedAt: now,
      pricingProgram,
    };
    this.pricingProgramVersions.set(version.id, version);
    return version;
  }

  public async getNextPricingProgramVersionNumber(pricingProgramId: string): Promise<number> {
    const versions = [...this.pricingProgramVersions.values()].filter(
      (item) => item.pricingProgramId === pricingProgramId,
    );
    const latest = versions.reduce((max, item) => Math.max(max, item.version), 0);
    return latest + 1;
  }

  public async getPricingProgramVersionById(
    pricingProgramVersionId: string,
  ): Promise<PricingProgramVersionRecord | null> {
    return this.pricingProgramVersions.get(pricingProgramVersionId) ?? null;
  }

  public async listPricingProgramVersionsByPricingProgramId(
    pricingProgramId: string,
  ): Promise<ReadonlyArray<PricingProgramVersionRecord>> {
    return [...this.pricingProgramVersions.values()].filter(
      (row) => row.pricingProgramId === pricingProgramId,
    );
  }
}

const createService = (): {
  repository: InMemoryProductManagementRepository;
  service: ProductManagementService;
} => {
  const repository = new InMemoryProductManagementRepository();
  const publisher = new InMemoryEventPublisher();
  return {
    repository,
    service: new ProductManagementService(repository, publisher),
  };
};

test("cannot edit ACTIVE product versions", async () => {
  const { service } = createService();

  const product = await service.createProduct({
    productCode: "vehicle-core",
    name: "Vehicle Core",
    description: null,
  });

  const component = await service.createComponent({
    componentCode: "coverage-base",
    type: "COVERAGE",
    name: "Coverage Base",
    description: null,
  });

  const componentVersion = await service.createComponentVersion({
    componentId: component.id,
    schema: { coverage: "base" },
    metadata: {},
    status: "ACTIVE",
  });

  const version = await service.createProductVersionDraft({
    productId: product.id,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    policySchema: {},
    exposureSchemas: {},
    pricingInputSchema: {},
    pricingProgramVersionId: null,
  });

  await service.addComponentVersionReference({
    productVersionId: version.id,
    componentVersionId: componentVersion.id,
    configOverrides: {},
  });

  await service.activateProductVersion(version.id);

  await assert.rejects(
    async () =>
      service.addComponentVersionReference({
        productVersionId: version.id,
        componentVersionId: componentVersion.id,
        configOverrides: {},
      }),
    (error: unknown) =>
      error instanceof ProductManagementDomainError &&
      error.message === "Only DRAFT product versions can be edited",
  );
});

test("activation creates ProductVersionSnapshot", async () => {
  const { service, repository } = createService();

  const product = await service.createProduct({
    productCode: "property-core",
    name: "Property Core",
    description: null,
  });

  const component = await service.createComponent({
    componentCode: "rule-basic",
    type: "RULE",
    name: "Rule Basic",
    description: null,
  });

  const componentVersion = await service.createComponentVersion({
    componentId: component.id,
    schema: { rule: "base" },
    metadata: {},
    status: "ACTIVE",
  });

  const version = await service.createProductVersionDraft({
    productId: product.id,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    policySchema: { policy: "schema" },
    exposureSchemas: { exposure: "schema" },
    pricingInputSchema: { pricing: "schema" },
    pricingProgramVersionId: null,
  });

  await service.addComponentVersionReference({
    productVersionId: version.id,
    componentVersionId: componentVersion.id,
    configOverrides: {},
  });

  await service.activateProductVersion(version.id);

  const snapshot = await repository.getProductVersionSnapshot(version.id);
  assert.ok(snapshot, "snapshot should exist after activation");
});

test("activation fails if referenced component versions are not ACTIVE", async () => {
  const { service } = createService();

  const product = await service.createProduct({
    productCode: "content-core",
    name: "Content Core",
    description: null,
  });

  const component = await service.createComponent({
    componentCode: "coverage-draft",
    type: "COVERAGE",
    name: "Coverage Draft",
    description: null,
  });

  const componentVersion = await service.createComponentVersion({
    componentId: component.id,
    schema: { coverage: "draft" },
    metadata: {},
    status: "DRAFT",
  });

  const version = await service.createProductVersionDraft({
    productId: product.id,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    policySchema: {},
    exposureSchemas: {},
    pricingInputSchema: {},
    pricingProgramVersionId: null,
  });

  await service.addComponentVersionReference({
    productVersionId: version.id,
    componentVersionId: componentVersion.id,
    configOverrides: {},
  });

  await assert.rejects(
    async () => service.activateProductVersion(version.id),
    (error: unknown) =>
      error instanceof ProductManagementDomainError &&
      error.message ===
        "All referenced component versions must be ACTIVE before activation",
  );
});
