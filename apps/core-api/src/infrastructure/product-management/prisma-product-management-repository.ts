import type {
  Component,
  ComponentVersion,
  PricingProgram,
  PricingProgramVersion,
  Prisma,
  Product,
  ProductVersion,
  ProductVersionComponentRef,
  ProductVersionSnapshot,
  PrismaClient,
} from "@prisma/client";
import type {
  ComponentRecord,
  ComponentVersionRecord,
  PricingProgramRecord,
  PricingProgramVersionRecord,
  ProductManagementRepository,
  ProductRecord,
  ProductVersionComponentRefRecord,
  ProductVersionRecord,
  ProductVersionSnapshotRecord,
} from "../../application/product-management/ports/repositories.js";
import type {
  ComponentType,
  ComponentVersionStatus,
  JsonObject,
  PricingProgramVersionStatus,
  ProductStatus,
  ProductVersionStatus,
} from "../../domain/product-management/index.js";

const asJsonObject = (value: unknown): JsonObject => {
  return (value ?? {}) as JsonObject;
};

const toInputJsonValue = (value: JsonObject): Prisma.InputJsonValue => {
  return value as Prisma.InputJsonValue;
};

const toProductRecord = (product: Product): ProductRecord => ({
  id: product.id,
  productCode: product.productCode,
  name: product.name,
  description: product.description,
  status: product.status,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const toProductVersionRecord = (productVersion: ProductVersion): ProductVersionRecord => ({
  id: productVersion.id,
  productId: productVersion.productId,
  version: productVersion.version,
  status: productVersion.status,
  effectiveFrom: productVersion.effectiveFrom,
  effectiveTo: productVersion.effectiveTo,
  policySchema: asJsonObject(productVersion.policySchema),
  exposureSchemas: asJsonObject(productVersion.exposureSchemas),
  pricingInputSchema: asJsonObject(productVersion.pricingInputSchema),
  defaultCurrency: productVersion.defaultCurrency,
  allowedCurrencies: [...productVersion.allowedCurrencies],
  pricingProgramVersionId: productVersion.pricingProgramVersionId,
  activatedAt: productVersion.activatedAt,
  createdAt: productVersion.createdAt,
  updatedAt: productVersion.updatedAt,
});

const toComponentRecord = (component: Component): ComponentRecord => ({
  id: component.id,
  componentCode: component.componentCode,
  type: component.type as ComponentType,
  name: component.name,
  description: component.description,
  createdAt: component.createdAt,
  updatedAt: component.updatedAt,
});

const toPricingProgramRecord = (program: PricingProgram): PricingProgramRecord => ({
  id: program.id,
  programCode: program.programCode,
  name: program.name,
  description: program.description,
  createdAt: program.createdAt,
  updatedAt: program.updatedAt,
});

export class PrismaProductManagementRepository implements ProductManagementRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createProduct(input: {
    productCode: string;
    name: string;
    description: string | null;
    status: ProductStatus;
  }): Promise<ProductRecord> {
    const created = await this.prisma.product.create({ data: input });
    return toProductRecord(created);
  }

  public async listProducts(): Promise<ReadonlyArray<ProductRecord>> {
    const products = await this.prisma.product.findMany({ orderBy: { createdAt: "desc" } });
    return products.map((product) => toProductRecord(product));
  }

  public async getProductById(productId: string): Promise<ProductRecord | null> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    return product ? toProductRecord(product) : null;
  }

  public async updateProduct(
    productId: string,
    patch: Partial<Pick<ProductRecord, "name" | "description" | "status">>,
  ): Promise<ProductRecord | null> {
    try {
      const updated = await this.prisma.product.update({ where: { id: productId }, data: patch });
      return toProductRecord(updated);
    } catch {
      return null;
    }
  }

  public async deleteProduct(productId: string): Promise<boolean> {
    try {
      await this.prisma.product.delete({ where: { id: productId } });
      return true;
    } catch {
      return false;
    }
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
    const created = await this.prisma.productVersion.create({
      data: {
        productId: input.productId,
        version: input.version,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        policySchema: toInputJsonValue(input.policySchema),
        exposureSchemas: toInputJsonValue(input.exposureSchemas),
        pricingInputSchema: toInputJsonValue(input.pricingInputSchema),
        defaultCurrency: input.defaultCurrency,
        allowedCurrencies: [...input.allowedCurrencies],
        pricingProgramVersionId: input.pricingProgramVersionId,
        status: "DRAFT",
      },
    });
    return toProductVersionRecord(created);
  }

  public async getProductVersionById(productVersionId: string): Promise<ProductVersionRecord | null> {
    const productVersion = await this.prisma.productVersion.findUnique({
      where: { id: productVersionId },
    });
    return productVersion ? toProductVersionRecord(productVersion) : null;
  }

  public async getNextProductVersionNumber(productId: string): Promise<number> {
    const latest = await this.prisma.productVersion.findFirst({
      where: { productId },
      orderBy: { version: "desc" },
    });
    return latest ? latest.version + 1 : 1;
  }

  public async updateProductVersionStatus(
    productVersionId: string,
    status: ProductVersionStatus,
    activatedAt?: Date,
  ): Promise<ProductVersionRecord> {
    const data: Prisma.ProductVersionUpdateInput = { status };
    if (activatedAt !== undefined) {
      data.activatedAt = activatedAt;
    }

    const updated = await this.prisma.productVersion.update({
      where: { id: productVersionId },
      data,
    });
    return toProductVersionRecord(updated);
  }

  public async addProductVersionComponentRef(input: {
    productVersionId: string;
    componentVersionId: string;
    configOverrides: JsonObject;
  }): Promise<ProductVersionComponentRefRecord> {
    const created = await this.prisma.productVersionComponentRef.create({
      data: {
        productVersionId: input.productVersionId,
        componentVersionId: input.componentVersionId,
        configOverrides: toInputJsonValue(input.configOverrides),
      },
      include: {
        componentVersion: {
          include: {
            component: true,
          },
        },
      },
    });
    return {
      id: created.id,
      productVersionId: created.productVersionId,
      componentVersionId: created.componentVersionId,
      configOverrides: asJsonObject(created.configOverrides),
      createdAt: created.createdAt,
      componentVersion: this.toComponentVersionRecord(created.componentVersion),
    };
  }

  public async removeProductVersionComponentRef(
    productVersionId: string,
    componentVersionId: string,
  ): Promise<boolean> {
    const deleted = await this.prisma.productVersionComponentRef.deleteMany({
      where: { productVersionId, componentVersionId },
    });
    return deleted.count > 0;
  }

  public async listProductVersionComponentRefs(
    productVersionId: string,
  ): Promise<ReadonlyArray<ProductVersionComponentRefRecord>> {
    const refs = await this.prisma.productVersionComponentRef.findMany({
      where: { productVersionId },
      include: {
        componentVersion: {
          include: {
            component: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return refs.map((ref) => this.toProductVersionComponentRefRecord(ref));
  }

  public async createProductVersionSnapshot(input: {
    productVersionId: string;
    resolvedSnapshot: JsonObject;
  }): Promise<ProductVersionSnapshotRecord> {
    const created = await this.prisma.productVersionSnapshot.create({
      data: {
        productVersionId: input.productVersionId,
        resolvedSnapshot: toInputJsonValue(input.resolvedSnapshot),
      },
    });
    return this.toProductVersionSnapshotRecord(created);
  }

  public async getProductVersionSnapshot(
    productVersionId: string,
  ): Promise<ProductVersionSnapshotRecord | null> {
    const snapshot = await this.prisma.productVersionSnapshot.findUnique({
      where: { productVersionId },
    });
    return snapshot ? this.toProductVersionSnapshotRecord(snapshot) : null;
  }

  public async createComponent(input: {
    componentCode: string;
    type: ComponentType;
    name: string;
    description: string | null;
  }): Promise<ComponentRecord> {
    const created = await this.prisma.component.create({ data: input });
    return toComponentRecord(created);
  }

  public async listComponents(type?: ComponentType): Promise<ReadonlyArray<ComponentRecord>> {
    const components =
      type !== undefined
        ? await this.prisma.component.findMany({
            where: { type },
            orderBy: { createdAt: "desc" },
          })
        : await this.prisma.component.findMany({
            orderBy: { createdAt: "desc" },
          });
    return components.map((component) => toComponentRecord(component));
  }

  public async getComponentById(componentId: string): Promise<ComponentRecord | null> {
    const component = await this.prisma.component.findUnique({ where: { id: componentId } });
    return component ? toComponentRecord(component) : null;
  }

  public async createComponentVersion(input: {
    componentId: string;
    version: number;
    status: ComponentVersionStatus;
    schema: JsonObject;
    metadata: JsonObject;
    releasedAt: Date | null;
  }): Promise<ComponentVersionRecord> {
    const created = await this.prisma.componentVersion.create({
      data: {
        componentId: input.componentId,
        version: input.version,
        status: input.status,
        schema: toInputJsonValue(input.schema),
        metadata: toInputJsonValue(input.metadata),
        releasedAt: input.releasedAt,
      },
      include: { component: true },
    });
    return {
      id: created.id,
      componentId: created.componentId,
      version: created.version,
      status: created.status as ComponentVersionStatus,
      schema: asJsonObject(created.schema),
      metadata: asJsonObject(created.metadata),
      releasedAt: created.releasedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      component: toComponentRecord(created.component),
    };
  }

  public async getNextComponentVersionNumber(componentId: string): Promise<number> {
    const latest = await this.prisma.componentVersion.findFirst({
      where: { componentId },
      orderBy: { version: "desc" },
    });
    return latest ? latest.version + 1 : 1;
  }

  public async getComponentVersionById(
    componentVersionId: string,
  ): Promise<ComponentVersionRecord | null> {
    const version = await this.prisma.componentVersion.findUnique({
      where: { id: componentVersionId },
      include: { component: true },
    });
    return version ? this.toComponentVersionRecord(version) : null;
  }

  public async getComponentVersionByCompositeKey(
    componentId: string,
    version: number,
  ): Promise<ComponentVersionRecord | null> {
    const componentVersion = await this.prisma.componentVersion.findUnique({
      where: { componentId_version: { componentId, version } },
      include: { component: true },
    });
    return componentVersion ? this.toComponentVersionRecord(componentVersion) : null;
  }

  public async createPricingProgram(input: {
    programCode: string;
    name: string;
    description: string | null;
  }): Promise<PricingProgramRecord> {
    const created = await this.prisma.pricingProgram.create({ data: input });
    return toPricingProgramRecord(created);
  }

  public async getPricingProgramById(pricingProgramId: string): Promise<PricingProgramRecord | null> {
    const pricingProgram = await this.prisma.pricingProgram.findUnique({
      where: { id: pricingProgramId },
    });
    return pricingProgram ? toPricingProgramRecord(pricingProgram) : null;
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
    const created = await this.prisma.pricingProgramVersion.create({
      data: {
        pricingProgramId: input.pricingProgramId,
        version: input.version,
        status: input.status,
        fileRef: input.fileRef,
        inputSchema: toInputJsonValue(input.inputSchema),
        outputSchema: toInputJsonValue(input.outputSchema),
        metadata: toInputJsonValue(input.metadata),
        releasedAt: input.releasedAt,
      },
      include: { pricingProgram: true },
    });
    return {
      id: created.id,
      pricingProgramId: created.pricingProgramId,
      version: created.version,
      status: created.status as PricingProgramVersionStatus,
      fileRef: created.fileRef,
      inputSchema: asJsonObject(created.inputSchema),
      outputSchema: asJsonObject(created.outputSchema),
      metadata: asJsonObject(created.metadata),
      releasedAt: created.releasedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      pricingProgram: toPricingProgramRecord(created.pricingProgram),
    };
  }

  public async getNextPricingProgramVersionNumber(pricingProgramId: string): Promise<number> {
    const latest = await this.prisma.pricingProgramVersion.findFirst({
      where: { pricingProgramId },
      orderBy: { version: "desc" },
    });
    return latest ? latest.version + 1 : 1;
  }

  public async getPricingProgramVersionById(
    pricingProgramVersionId: string,
  ): Promise<PricingProgramVersionRecord | null> {
    const version = await this.prisma.pricingProgramVersion.findUnique({
      where: { id: pricingProgramVersionId },
      include: { pricingProgram: true },
    });
    return version ? this.toPricingProgramVersionRecord(version) : null;
  }

  private toProductVersionSnapshotRecord(snapshot: ProductVersionSnapshot): ProductVersionSnapshotRecord {
    return {
      id: snapshot.id,
      productVersionId: snapshot.productVersionId,
      resolvedSnapshot: asJsonObject(snapshot.resolvedSnapshot),
      createdAt: snapshot.createdAt,
    };
  }

  private toComponentVersionRecord(
    componentVersion: ComponentVersion & { component: Component },
  ): ComponentVersionRecord {
    return {
      id: componentVersion.id,
      componentId: componentVersion.componentId,
      version: componentVersion.version,
      status: componentVersion.status as ComponentVersionStatus,
      schema: asJsonObject(componentVersion.schema),
      metadata: asJsonObject(componentVersion.metadata),
      releasedAt: componentVersion.releasedAt,
      createdAt: componentVersion.createdAt,
      updatedAt: componentVersion.updatedAt,
      component: toComponentRecord(componentVersion.component),
    };
  }

  private toPricingProgramVersionRecord(
    version: PricingProgramVersion & { pricingProgram: PricingProgram },
  ): PricingProgramVersionRecord {
    return {
      id: version.id,
      pricingProgramId: version.pricingProgramId,
      version: version.version,
      status: version.status as PricingProgramVersionStatus,
      fileRef: version.fileRef,
      inputSchema: asJsonObject(version.inputSchema),
      outputSchema: asJsonObject(version.outputSchema),
      metadata: asJsonObject(version.metadata),
      releasedAt: version.releasedAt,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      pricingProgram: toPricingProgramRecord(version.pricingProgram),
    };
  }

  private toProductVersionComponentRefRecord(
    ref: ProductVersionComponentRef & {
      componentVersion: ComponentVersion & { component: Component };
    },
  ): ProductVersionComponentRefRecord {
    return {
      id: ref.id,
      productVersionId: ref.productVersionId,
      componentVersionId: ref.componentVersionId,
      configOverrides: asJsonObject(ref.configOverrides),
      createdAt: ref.createdAt,
      componentVersion: this.toComponentVersionRecord(ref.componentVersion),
    };
  }
}
