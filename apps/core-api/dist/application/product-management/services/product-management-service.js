import { assertActiveComponentVersions, assertActivatableProductVersion, assertEditableProductVersion, assertEffectiveRange, assertRetirableProductVersion, buildProductVersionSnapshotPayload, } from "../../../domain/product-management/index.js";
import { toComponentDto, toComponentVersionDto, toPricingProgramDto, toPricingProgramVersionDto, toProductDto, toProductVersionDto, toProductVersionSnapshotDto, } from "./dto.js";
import { ProductManagementApplicationError } from "./errors.js";
const toEventData = (value) => {
    return structuredClone(value);
};
export class ProductManagementService {
    repository;
    eventPublisher;
    constructor(repository, eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }
    async createProduct(input) {
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
    async listProducts() {
        const products = await this.repository.listProducts();
        return products.map((product) => toProductDto(product));
    }
    async getProductById(productId) {
        const product = await this.repository.getProductById(productId);
        if (!product) {
            throw new ProductManagementApplicationError("Product not found", 404);
        }
        return toProductDto(product);
    }
    async updateProduct(productId, patch) {
        const updated = await this.repository.updateProduct(productId, patch);
        if (!updated) {
            throw new ProductManagementApplicationError("Product not found", 404);
        }
        return toProductDto(updated);
    }
    async deleteProduct(productId) {
        const deleted = await this.repository.deleteProduct(productId);
        return { deleted };
    }
    async createProductVersionDraft(input) {
        const product = await this.repository.getProductById(input.productId);
        if (!product) {
            throw new ProductManagementApplicationError("Product not found", 404);
        }
        assertEffectiveRange(input.effectiveFrom, input.effectiveTo);
        if (input.pricingProgramVersionId) {
            const pricingProgramVersion = await this.repository.getPricingProgramVersionById(input.pricingProgramVersionId);
            if (!pricingProgramVersion) {
                throw new ProductManagementApplicationError("PricingProgramVersion not found", 404);
            }
        }
        const version = await this.repository.getNextProductVersionNumber(input.productId);
        const created = await this.repository.createProductVersion({
            productId: input.productId,
            version,
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo,
            policySchema: input.policySchema,
            exposureSchemas: input.exposureSchemas,
            pricingInputSchema: input.pricingInputSchema,
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
    async addComponentVersionReference(input) {
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
    async removeComponentVersionReference(input) {
        const productVersion = await this.repository.getProductVersionById(input.productVersionId);
        if (!productVersion) {
            throw new ProductManagementApplicationError("ProductVersion not found", 404);
        }
        assertEditableProductVersion(productVersion.status);
        const deleted = await this.repository.removeProductVersionComponentRef(input.productVersionId, input.componentVersionId);
        return { deleted };
    }
    async activateProductVersion(productVersionId) {
        const productVersion = await this.repository.getProductVersionById(productVersionId);
        if (!productVersion) {
            throw new ProductManagementApplicationError("ProductVersion not found", 404);
        }
        assertActivatableProductVersion(productVersion.status);
        const refs = await this.repository.listProductVersionComponentRefs(productVersionId);
        assertActiveComponentVersions(refs.map((reference) => reference.componentVersion.status));
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
            resolvedSnapshot: snapshotPayload,
        });
        const updated = await this.repository.updateProductVersionStatus(productVersionId, "ACTIVE", new Date());
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
    async retireProductVersion(productVersionId) {
        const productVersion = await this.repository.getProductVersionById(productVersionId);
        if (!productVersion) {
            throw new ProductManagementApplicationError("ProductVersion not found", 404);
        }
        assertRetirableProductVersion(productVersion.status);
        const updated = await this.repository.updateProductVersionStatus(productVersionId, "RETIRED");
        return toProductVersionDto(updated);
    }
    async createComponent(input) {
        const component = await this.repository.createComponent(input);
        return toComponentDto(component);
    }
    async listComponents(type) {
        const components = await this.repository.listComponents(type);
        return components.map((component) => toComponentDto(component));
    }
    async getComponentVersionByCompositeKey(componentId, version) {
        const componentVersion = await this.repository.getComponentVersionByCompositeKey(componentId, version);
        if (!componentVersion) {
            throw new ProductManagementApplicationError("ComponentVersion not found", 404);
        }
        return toComponentVersionDto(componentVersion);
    }
    async createComponentVersion(input) {
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
    async createPricingProgram(input) {
        const created = await this.repository.createPricingProgram(input);
        return toPricingProgramDto(created);
    }
    async createPricingProgramVersion(input) {
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
    toSnapshotComponent(reference) {
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
