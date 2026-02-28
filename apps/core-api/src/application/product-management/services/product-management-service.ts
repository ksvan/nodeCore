import {
  assertActiveComponentVersions,
  assertActivatableProductVersion,
  assertEditableProductVersion,
  assertEffectiveRange,
  assertRetirableProductVersion,
  buildProductVersionSnapshotPayload,
  type ComponentVersionStatus,
  type JsonObject,
  type PricingProgramVersionStatus,
  type ProductStatus,
} from "../../../domain/product-management/index.js";
import type {
  DomainEventPublisher,
  ProductManagementRepository,
  ProductVersionComponentRefRecord,
} from "../ports/repositories.js";
import {
  toComponentDto,
  toComponentVersionDto,
  toPricingProgramDto,
  toPricingProgramVersionDto,
  toProductDto,
  toProductVersionDto,
  toProductVersionSnapshotDto,
  type ComponentDto,
  type ComponentVersionDto,
  type PricingProgramDto,
  type PricingProgramVersionDto,
  type ProductDto,
  type ProductVersionDto,
  type ProductVersionSnapshotDto,
} from "./dto.js";
import { ProductManagementApplicationError } from "./errors.js";

interface ActivationResult {
  productVersion: ProductVersionDto;
  snapshot: ProductVersionSnapshotDto;
}

const toEventData = (value: unknown): Record<string, unknown> => {
  return structuredClone(value) as Record<string, unknown>;
};

export class ProductManagementService {
  public constructor(
    private readonly repository: ProductManagementRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  public async createProduct(input: {
    productCode: string;
    name: string;
    description: string | null;
    status?: ProductStatus;
  }): Promise<ProductDto> {
    const product = await this.repository.createProduct({
      productCode: input.productCode,
      name: input.name,
      description: input.description,
      status: input.status ?? "DRAFT",
    });

    const dto = toProductDto(product);
    await this.eventPublisher.publish({
      eventType: "ProductCreated",
      entityType: "Product",
      entityId: dto.id,
      data: toEventData(dto),
    });
    return dto;
  }

  public async listProductVersions(productId: string): Promise<ReadonlyArray<ProductVersionDto>> {
    const product = await this.repository.getProductById(productId);
    if (!product) {
      throw new ProductManagementApplicationError("Product not found", 404);
    }
    const rows = await this.repository.listProductVersionsByProductId(productId);
    return rows.map((row) => toProductVersionDto(row));
  }

  public async getProductVersion(productVersionId: string): Promise<ProductVersionDto> {
    const row = await this.repository.getProductVersionById(productVersionId);
    if (!row) {
      throw new ProductManagementApplicationError("ProductVersion not found", 404);
    }
    return toProductVersionDto(row);
  }

  public async listProductVersionComponentRefs(productVersionId: string): Promise<
    ReadonlyArray<{
      id: string;
      productVersionId: string;
      componentVersionId: string;
      configOverrides: JsonObject;
      createdAt: string;
      componentVersion: ComponentVersionDto;
    }>
  > {
    const row = await this.repository.getProductVersionById(productVersionId);
    if (!row) {
      throw new ProductManagementApplicationError("ProductVersion not found", 404);
    }
    const refs = await this.repository.listProductVersionComponentRefs(productVersionId);
    return refs.map((ref) => ({
      id: ref.id,
      productVersionId: ref.productVersionId,
      componentVersionId: ref.componentVersionId,
      configOverrides: structuredClone(ref.configOverrides),
      createdAt: ref.createdAt.toISOString(),
      componentVersion: toComponentVersionDto(ref.componentVersion),
    }));
  }

  public async getProductVersionSnapshot(
    productVersionId: string,
  ): Promise<ProductVersionSnapshotDto | null> {
    const snapshot = await this.repository.getProductVersionSnapshot(productVersionId);
    return snapshot ? toProductVersionSnapshotDto(snapshot) : null;
  }

  public async listProducts(): Promise<ReadonlyArray<ProductDto>> {
    const products = await this.repository.listProducts();
    return products.map((product) => toProductDto(product));
  }

  public async getProductById(productId: string): Promise<ProductDto> {
    const product = await this.repository.getProductById(productId);
    if (!product) {
      throw new ProductManagementApplicationError("Product not found", 404);
    }
    return toProductDto(product);
  }

  public async updateProduct(
    productId: string,
    patch: Partial<{ name: string; description: string | null; status: ProductStatus }>,
  ): Promise<ProductDto> {
    const updated = await this.repository.updateProduct(productId, patch);
    if (!updated) {
      throw new ProductManagementApplicationError("Product not found", 404);
    }
    return toProductDto(updated);
  }

  public async deleteProduct(productId: string): Promise<{ deleted: boolean }> {
    const deleted = await this.repository.deleteProduct(productId);
    return { deleted };
  }

  public async createProductVersionDraft(input: {
    productId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    policySchema: JsonObject;
    exposureSchemas: JsonObject;
    pricingInputSchema: JsonObject;
    defaultCurrency?: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    allowedCurrencies?: ReadonlyArray<"SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK">;
    pricingProgramVersionId: string | null;
  }): Promise<ProductVersionDto> {
    const product = await this.repository.getProductById(input.productId);
    if (!product) {
      throw new ProductManagementApplicationError("Product not found", 404);
    }
    assertEffectiveRange(input.effectiveFrom, input.effectiveTo);

    if (input.pricingProgramVersionId) {
      const pricingProgramVersion = await this.repository.getPricingProgramVersionById(
        input.pricingProgramVersionId,
      );
      if (!pricingProgramVersion) {
        throw new ProductManagementApplicationError("PricingProgramVersion not found", 404);
      }
    }

    const version = await this.repository.getNextProductVersionNumber(input.productId);
    const defaultCurrency = input.defaultCurrency ?? "SEK";
    const allowedCurrencies = input.allowedCurrencies?.length
      ? [...new Set(input.allowedCurrencies)]
      : [defaultCurrency];

    if (!allowedCurrencies.includes(defaultCurrency)) {
      throw new ProductManagementApplicationError(
        "defaultCurrency must be included in allowedCurrencies",
        400,
      );
    }

    const created = await this.repository.createProductVersion({
      productId: input.productId,
      version,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      policySchema: input.policySchema,
      exposureSchemas: input.exposureSchemas,
      pricingInputSchema: input.pricingInputSchema,
      defaultCurrency,
      allowedCurrencies,
      pricingProgramVersionId: input.pricingProgramVersionId,
    });

    const dto = toProductVersionDto(created);
    await this.eventPublisher.publish({
      eventType: "ProductVersionCreated",
      entityType: "ProductVersion",
      entityId: dto.id,
      data: toEventData(dto),
    });
    return dto;
  }

  public async addComponentVersionReference(input: {
    productVersionId: string;
    componentVersionId: string;
    configOverrides: JsonObject;
  }): Promise<{ id: string; productVersionId: string; componentVersionId: string; configOverrides: JsonObject }> {
    const productVersion = await this.repository.getProductVersionById(input.productVersionId);
    if (!productVersion) {
      throw new ProductManagementApplicationError("ProductVersion not found", 404);
    }
    assertEditableProductVersion(productVersion.status);

    const componentVersion = await this.repository.getComponentVersionById(input.componentVersionId);
    if (!componentVersion) {
      throw new ProductManagementApplicationError("ComponentVersion not found", 404);
    }

    const created = await this.repository.addProductVersionComponentRef(input);
    return {
      id: created.id,
      productVersionId: created.productVersionId,
      componentVersionId: created.componentVersionId,
      configOverrides: structuredClone(created.configOverrides),
    };
  }

  public async removeComponentVersionReference(input: {
    productVersionId: string;
    componentVersionId: string;
  }): Promise<{ deleted: boolean }> {
    const productVersion = await this.repository.getProductVersionById(input.productVersionId);
    if (!productVersion) {
      throw new ProductManagementApplicationError("ProductVersion not found", 404);
    }
    assertEditableProductVersion(productVersion.status);

    const deleted = await this.repository.removeProductVersionComponentRef(
      input.productVersionId,
      input.componentVersionId,
    );
    return { deleted };
  }

  public async activateProductVersion(productVersionId: string): Promise<ActivationResult> {
    const productVersion = await this.repository.getProductVersionById(productVersionId);
    if (!productVersion) {
      throw new ProductManagementApplicationError("ProductVersion not found", 404);
    }
    assertActivatableProductVersion(productVersion.status);

    const refs = await this.repository.listProductVersionComponentRefs(productVersionId);
    assertActiveComponentVersions(
      refs.map((reference) => reference.componentVersion.status as ComponentVersionStatus),
    );

    const snapshotPayload = buildProductVersionSnapshotPayload({
      productVersionId: productVersion.id,
      productId: productVersion.productId,
      version: productVersion.version,
      policySchema: productVersion.policySchema,
      exposureSchemas: productVersion.exposureSchemas,
      pricingInputSchema: productVersion.pricingInputSchema,
      components: refs.map((reference) => this.toSnapshotComponent(reference)),
    });

    const createdSnapshot = await this.repository.createProductVersionSnapshot({
      productVersionId,
      resolvedSnapshot: snapshotPayload as unknown as JsonObject,
    });

    const updated = await this.repository.updateProductVersionStatus(
      productVersionId,
      "ACTIVE",
      new Date(),
    );

    const productVersionDto = toProductVersionDto(updated);
    const snapshotDto = toProductVersionSnapshotDto(createdSnapshot);

    await this.eventPublisher.publish({
      eventType: "ProductVersionActivated",
      entityType: "ProductVersion",
      entityId: productVersionDto.id,
      data: toEventData(productVersionDto),
    });

    return {
      productVersion: productVersionDto,
      snapshot: snapshotDto,
    };
  }

  public async retireProductVersion(productVersionId: string): Promise<ProductVersionDto> {
    const productVersion = await this.repository.getProductVersionById(productVersionId);
    if (!productVersion) {
      throw new ProductManagementApplicationError("ProductVersion not found", 404);
    }

    assertRetirableProductVersion(productVersion.status);

    const updated = await this.repository.updateProductVersionStatus(productVersionId, "RETIRED");
    return toProductVersionDto(updated);
  }

  public async createComponent(input: {
    componentCode: string;
    type: "COVERAGE" | "EXPOSURE" | "RULE";
    name: string;
    description: string | null;
  }): Promise<ComponentDto> {
    const component = await this.repository.createComponent(input);
    return toComponentDto(component);
  }

  public async listComponents(type?: "COVERAGE" | "EXPOSURE" | "RULE"): Promise<ReadonlyArray<ComponentDto>> {
    const components = await this.repository.listComponents(type);
    return components.map((component) => toComponentDto(component));
  }

  public async getComponent(componentId: string): Promise<ComponentDto> {
    const component = await this.repository.getComponentById(componentId);
    if (!component) {
      throw new ProductManagementApplicationError("Component not found", 404);
    }
    return toComponentDto(component);
  }

  public async listComponentVersions(componentId: string): Promise<ReadonlyArray<ComponentVersionDto>> {
    const component = await this.repository.getComponentById(componentId);
    if (!component) {
      throw new ProductManagementApplicationError("Component not found", 404);
    }
    const rows = await this.repository.listComponentVersionsByComponentId(componentId);
    return rows.map((row) => toComponentVersionDto(row));
  }

  public async getComponentVersionByCompositeKey(
    componentId: string,
    version: number,
  ): Promise<ComponentVersionDto> {
    const componentVersion = await this.repository.getComponentVersionByCompositeKey(componentId, version);
    if (!componentVersion) {
      throw new ProductManagementApplicationError("ComponentVersion not found", 404);
    }
    return toComponentVersionDto(componentVersion);
  }

  public async createComponentVersion(input: {
    componentId: string;
    schema: JsonObject;
    metadata: JsonObject;
    status?: ComponentVersionStatus;
  }): Promise<ComponentVersionDto> {
    const component = await this.repository.getComponentById(input.componentId);
    if (!component) {
      throw new ProductManagementApplicationError("Component not found", 404);
    }

    const version = await this.repository.getNextComponentVersionNumber(input.componentId);
    const status = input.status ?? "DRAFT";
    const created = await this.repository.createComponentVersion({
      componentId: input.componentId,
      version,
      status,
      schema: input.schema,
      metadata: input.metadata,
      releasedAt: status === "ACTIVE" ? new Date() : null,
    });

    const dto = toComponentVersionDto(created);
    if (status === "ACTIVE") {
      await this.eventPublisher.publish({
        eventType: "ComponentVersionReleased",
        entityType: "ComponentVersion",
        entityId: dto.id,
        data: toEventData(dto),
      });
    }
    return dto;
  }

  public async createPricingProgram(input: {
    programCode: string;
    name: string;
    description: string | null;
  }): Promise<PricingProgramDto> {
    const created = await this.repository.createPricingProgram(input);
    return toPricingProgramDto(created);
  }

  public async listPricingPrograms(): Promise<ReadonlyArray<PricingProgramDto>> {
    const rows = await this.repository.listPricingPrograms();
    return rows.map((row) => toPricingProgramDto(row));
  }

  public async getPricingProgram(pricingProgramId: string): Promise<PricingProgramDto> {
    const row = await this.repository.getPricingProgramById(pricingProgramId);
    if (!row) {
      throw new ProductManagementApplicationError("PricingProgram not found", 404);
    }
    return toPricingProgramDto(row);
  }

  public async listPricingProgramVersions(
    pricingProgramId: string,
  ): Promise<ReadonlyArray<PricingProgramVersionDto>> {
    const program = await this.repository.getPricingProgramById(pricingProgramId);
    if (!program) {
      throw new ProductManagementApplicationError("PricingProgram not found", 404);
    }
    const rows = await this.repository.listPricingProgramVersionsByPricingProgramId(pricingProgramId);
    return rows.map((row) => toPricingProgramVersionDto(row));
  }

  public async createPricingProgramVersion(input: {
    pricingProgramId: string;
    fileRef: string;
    inputSchema: JsonObject;
    outputSchema: JsonObject;
    metadata: JsonObject;
    status?: PricingProgramVersionStatus;
  }): Promise<PricingProgramVersionDto> {
    const pricingProgram = await this.repository.getPricingProgramById(input.pricingProgramId);
    if (!pricingProgram) {
      throw new ProductManagementApplicationError("PricingProgram not found", 404);
    }

    const version = await this.repository.getNextPricingProgramVersionNumber(input.pricingProgramId);
    const status = input.status ?? "DRAFT";

    const created = await this.repository.createPricingProgramVersion({
      pricingProgramId: input.pricingProgramId,
      version,
      status,
      fileRef: input.fileRef,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      metadata: input.metadata,
      releasedAt: status === "ACTIVE" ? new Date() : null,
    });

    const dto = toPricingProgramVersionDto(created);
    if (status === "ACTIVE") {
      await this.eventPublisher.publish({
        eventType: "PricingProgramVersionReleased",
        entityType: "PricingProgramVersion",
        entityId: dto.id,
        data: toEventData(dto),
      });
    }
    return dto;
  }

  private toSnapshotComponent(reference: ProductVersionComponentRefRecord): {
    componentId: string;
    componentVersionId: string;
    componentType: "COVERAGE" | "EXPOSURE" | "RULE";
    version: number;
    schema: JsonObject;
    metadata: JsonObject;
    configOverrides: JsonObject;
  } {
    return {
      componentId: reference.componentVersion.component.id,
      componentVersionId: reference.componentVersion.id,
      componentType: reference.componentVersion.component.type,
      version: reference.componentVersion.version,
      schema: structuredClone(reference.componentVersion.schema),
      metadata: structuredClone(reference.componentVersion.metadata),
      configOverrides: structuredClone(reference.configOverrides),
    };
  }
}
