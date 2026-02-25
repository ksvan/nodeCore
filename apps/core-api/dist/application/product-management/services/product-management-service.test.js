import { randomUUID } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { ProductManagementService } from "./product-management-service.js";
import { ProductManagementDomainError } from "../../../domain/product-management/errors.js";
class InMemoryEventPublisher {
    events = [];
    async publish(input) {
        this.events.push({ eventType: input.eventType, entityId: input.entityId, data: input.data });
    }
}
class InMemoryProductManagementRepository {
    products = new Map();
    productVersions = new Map();
    componentVersions = new Map();
    components = new Map();
    refs = new Map();
    snapshots = new Map();
    pricingPrograms = new Map();
    pricingProgramVersions = new Map();
    async createProduct(input) {
        const now = new Date();
        const product = {
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
    async listProducts() {
        return [...this.products.values()];
    }
    async getProductById(productId) {
        return this.products.get(productId) ?? null;
    }
    async updateProduct(productId, patch) {
        const existing = this.products.get(productId);
        if (!existing) {
            return null;
        }
        const updated = { ...existing, ...patch, updatedAt: new Date() };
        this.products.set(productId, updated);
        return updated;
    }
    async deleteProduct(productId) {
        return this.products.delete(productId);
    }
    async createProductVersion(input) {
        const now = new Date();
        const productVersion = {
            id: randomUUID(),
            productId: input.productId,
            version: input.version,
            status: "DRAFT",
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo,
            policySchema: input.policySchema,
            exposureSchemas: input.exposureSchemas,
            pricingInputSchema: input.pricingInputSchema,
            pricingProgramVersionId: input.pricingProgramVersionId,
            activatedAt: null,
            createdAt: now,
            updatedAt: now,
        };
        this.productVersions.set(productVersion.id, productVersion);
        return productVersion;
    }
    async getProductVersionById(productVersionId) {
        return this.productVersions.get(productVersionId) ?? null;
    }
    async getNextProductVersionNumber(productId) {
        const versions = [...this.productVersions.values()].filter((version) => version.productId === productId);
        const latest = versions.reduce((max, item) => Math.max(max, item.version), 0);
        return latest + 1;
    }
    async updateProductVersionStatus(productVersionId, status, activatedAt) {
        const existing = this.productVersions.get(productVersionId);
        if (!existing) {
            throw new Error("not found");
        }
        const updated = {
            ...existing,
            status,
            activatedAt: activatedAt ?? existing.activatedAt,
            updatedAt: new Date(),
        };
        this.productVersions.set(productVersionId, updated);
        return updated;
    }
    async addProductVersionComponentRef(input) {
        const componentVersion = this.componentVersions.get(input.componentVersionId);
        if (!componentVersion) {
            throw new Error("component version not found");
        }
        const ref = {
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
    async removeProductVersionComponentRef(productVersionId, componentVersionId) {
        const entry = [...this.refs.entries()].find(([, value]) => value.productVersionId === productVersionId && value.componentVersionId === componentVersionId);
        if (!entry) {
            return false;
        }
        this.refs.delete(entry[0]);
        return true;
    }
    async listProductVersionComponentRefs(productVersionId) {
        return [...this.refs.values()].filter((ref) => ref.productVersionId === productVersionId);
    }
    async createProductVersionSnapshot(input) {
        const snapshot = {
            id: randomUUID(),
            productVersionId: input.productVersionId,
            resolvedSnapshot: input.resolvedSnapshot,
            createdAt: new Date(),
        };
        this.snapshots.set(input.productVersionId, snapshot);
        return snapshot;
    }
    async getProductVersionSnapshot(productVersionId) {
        return this.snapshots.get(productVersionId) ?? null;
    }
    async createComponent(input) {
        const now = new Date();
        const component = {
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
    async listComponents(type) {
        const all = [...this.components.values()];
        return type ? all.filter((component) => component.type === type) : all;
    }
    async getComponentById(componentId) {
        return this.components.get(componentId) ?? null;
    }
    async createComponentVersion(input) {
        const component = this.components.get(input.componentId);
        if (!component) {
            throw new Error("component not found");
        }
        const now = new Date();
        const componentVersion = {
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
    async getNextComponentVersionNumber(componentId) {
        const versions = [...this.componentVersions.values()].filter((item) => item.componentId === componentId);
        const latest = versions.reduce((max, item) => Math.max(max, item.version), 0);
        return latest + 1;
    }
    async getComponentVersionById(componentVersionId) {
        return this.componentVersions.get(componentVersionId) ?? null;
    }
    async getComponentVersionByCompositeKey(componentId, version) {
        return ([...this.componentVersions.values()].find((item) => item.componentId === componentId && item.version === version) ?? null);
    }
    async createPricingProgram(input) {
        const now = new Date();
        const program = {
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
    async getPricingProgramById(pricingProgramId) {
        return this.pricingPrograms.get(pricingProgramId) ?? null;
    }
    async createPricingProgramVersion(input) {
        const pricingProgram = this.pricingPrograms.get(input.pricingProgramId);
        if (!pricingProgram) {
            throw new Error("pricing program not found");
        }
        const now = new Date();
        const version = {
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
    async getNextPricingProgramVersionNumber(pricingProgramId) {
        const versions = [...this.pricingProgramVersions.values()].filter((item) => item.pricingProgramId === pricingProgramId);
        const latest = versions.reduce((max, item) => Math.max(max, item.version), 0);
        return latest + 1;
    }
    async getPricingProgramVersionById(pricingProgramVersionId) {
        return this.pricingProgramVersions.get(pricingProgramVersionId) ?? null;
    }
}
const createService = () => {
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
    await assert.rejects(async () => service.addComponentVersionReference({
        productVersionId: version.id,
        componentVersionId: componentVersion.id,
        configOverrides: {},
    }), (error) => error instanceof ProductManagementDomainError &&
        error.message === "Only DRAFT product versions can be edited");
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
    await assert.rejects(async () => service.activateProductVersion(version.id), (error) => error instanceof ProductManagementDomainError &&
        error.message ===
            "All referenced component versions must be ACTIVE before activation");
});
