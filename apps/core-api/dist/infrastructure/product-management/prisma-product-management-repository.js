const asJsonObject = (value) => {
    return (value ?? {});
};
const toInputJsonValue = (value) => {
    return value;
};
const toProductRecord = (product) => ({
    id: product.id,
    productCode: product.productCode,
    name: product.name,
    description: product.description,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
});
const toProductVersionRecord = (productVersion) => ({
    id: productVersion.id,
    productId: productVersion.productId,
    version: productVersion.version,
    status: productVersion.status,
    effectiveFrom: productVersion.effectiveFrom,
    effectiveTo: productVersion.effectiveTo,
    policySchema: asJsonObject(productVersion.policySchema),
    exposureSchemas: asJsonObject(productVersion.exposureSchemas),
    pricingInputSchema: asJsonObject(productVersion.pricingInputSchema),
    pricingProgramVersionId: productVersion.pricingProgramVersionId,
    activatedAt: productVersion.activatedAt,
    createdAt: productVersion.createdAt,
    updatedAt: productVersion.updatedAt,
});
const toComponentRecord = (component) => ({
    id: component.id,
    componentCode: component.componentCode,
    type: component.type,
    name: component.name,
    description: component.description,
    createdAt: component.createdAt,
    updatedAt: component.updatedAt,
});
const toPricingProgramRecord = (program) => ({
    id: program.id,
    programCode: program.programCode,
    name: program.name,
    description: program.description,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
});
export class PrismaProductManagementRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createProduct(input) {
        const created = await this.prisma.product.create({ data: input });
        return toProductRecord(created);
    }
    async listProducts() {
        const products = await this.prisma.product.findMany({ orderBy: { createdAt: "desc" } });
        return products.map((product) => toProductRecord(product));
    }
    async getProductById(productId) {
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        return product ? toProductRecord(product) : null;
    }
    async updateProduct(productId, patch) {
        try {
            const updated = await this.prisma.product.update({ where: { id: productId }, data: patch });
            return toProductRecord(updated);
        }
        catch {
            return null;
        }
    }
    async deleteProduct(productId) {
        try {
            await this.prisma.product.delete({ where: { id: productId } });
            return true;
        }
        catch {
            return false;
        }
    }
    async createProductVersion(input) {
        const created = await this.prisma.productVersion.create({
            data: {
                productId: input.productId,
                version: input.version,
                effectiveFrom: input.effectiveFrom,
                effectiveTo: input.effectiveTo,
                policySchema: toInputJsonValue(input.policySchema),
                exposureSchemas: toInputJsonValue(input.exposureSchemas),
                pricingInputSchema: toInputJsonValue(input.pricingInputSchema),
                pricingProgramVersionId: input.pricingProgramVersionId,
                status: "DRAFT",
            },
        });
        return toProductVersionRecord(created);
    }
    async getProductVersionById(productVersionId) {
        const productVersion = await this.prisma.productVersion.findUnique({
            where: { id: productVersionId },
        });
        return productVersion ? toProductVersionRecord(productVersion) : null;
    }
    async getNextProductVersionNumber(productId) {
        const latest = await this.prisma.productVersion.findFirst({
            where: { productId },
            orderBy: { version: "desc" },
        });
        return latest ? latest.version + 1 : 1;
    }
    async updateProductVersionStatus(productVersionId, status, activatedAt) {
        const data = { status };
        if (activatedAt !== undefined) {
            data.activatedAt = activatedAt;
        }
        const updated = await this.prisma.productVersion.update({
            where: { id: productVersionId },
            data,
        });
        return toProductVersionRecord(updated);
    }
    async addProductVersionComponentRef(input) {
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
    async removeProductVersionComponentRef(productVersionId, componentVersionId) {
        const deleted = await this.prisma.productVersionComponentRef.deleteMany({
            where: { productVersionId, componentVersionId },
        });
        return deleted.count > 0;
    }
    async listProductVersionComponentRefs(productVersionId) {
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
    async createProductVersionSnapshot(input) {
        const created = await this.prisma.productVersionSnapshot.create({
            data: {
                productVersionId: input.productVersionId,
                resolvedSnapshot: toInputJsonValue(input.resolvedSnapshot),
            },
        });
        return this.toProductVersionSnapshotRecord(created);
    }
    async getProductVersionSnapshot(productVersionId) {
        const snapshot = await this.prisma.productVersionSnapshot.findUnique({
            where: { productVersionId },
        });
        return snapshot ? this.toProductVersionSnapshotRecord(snapshot) : null;
    }
    async createComponent(input) {
        const created = await this.prisma.component.create({ data: input });
        return toComponentRecord(created);
    }
    async listComponents(type) {
        const components = type !== undefined
            ? await this.prisma.component.findMany({
                where: { type },
                orderBy: { createdAt: "desc" },
            })
            : await this.prisma.component.findMany({
                orderBy: { createdAt: "desc" },
            });
        return components.map((component) => toComponentRecord(component));
    }
    async getComponentById(componentId) {
        const component = await this.prisma.component.findUnique({ where: { id: componentId } });
        return component ? toComponentRecord(component) : null;
    }
    async createComponentVersion(input) {
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
            status: created.status,
            schema: asJsonObject(created.schema),
            metadata: asJsonObject(created.metadata),
            releasedAt: created.releasedAt,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
            component: toComponentRecord(created.component),
        };
    }
    async getNextComponentVersionNumber(componentId) {
        const latest = await this.prisma.componentVersion.findFirst({
            where: { componentId },
            orderBy: { version: "desc" },
        });
        return latest ? latest.version + 1 : 1;
    }
    async getComponentVersionById(componentVersionId) {
        const version = await this.prisma.componentVersion.findUnique({
            where: { id: componentVersionId },
            include: { component: true },
        });
        return version ? this.toComponentVersionRecord(version) : null;
    }
    async getComponentVersionByCompositeKey(componentId, version) {
        const componentVersion = await this.prisma.componentVersion.findUnique({
            where: { componentId_version: { componentId, version } },
            include: { component: true },
        });
        return componentVersion ? this.toComponentVersionRecord(componentVersion) : null;
    }
    async createPricingProgram(input) {
        const created = await this.prisma.pricingProgram.create({ data: input });
        return toPricingProgramRecord(created);
    }
    async getPricingProgramById(pricingProgramId) {
        const pricingProgram = await this.prisma.pricingProgram.findUnique({
            where: { id: pricingProgramId },
        });
        return pricingProgram ? toPricingProgramRecord(pricingProgram) : null;
    }
    async createPricingProgramVersion(input) {
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
            status: created.status,
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
    async getNextPricingProgramVersionNumber(pricingProgramId) {
        const latest = await this.prisma.pricingProgramVersion.findFirst({
            where: { pricingProgramId },
            orderBy: { version: "desc" },
        });
        return latest ? latest.version + 1 : 1;
    }
    async getPricingProgramVersionById(pricingProgramVersionId) {
        const version = await this.prisma.pricingProgramVersion.findUnique({
            where: { id: pricingProgramVersionId },
            include: { pricingProgram: true },
        });
        return version ? this.toPricingProgramVersionRecord(version) : null;
    }
    toProductVersionSnapshotRecord(snapshot) {
        return {
            id: snapshot.id,
            productVersionId: snapshot.productVersionId,
            resolvedSnapshot: asJsonObject(snapshot.resolvedSnapshot),
            createdAt: snapshot.createdAt,
        };
    }
    toComponentVersionRecord(componentVersion) {
        return {
            id: componentVersion.id,
            componentId: componentVersion.componentId,
            version: componentVersion.version,
            status: componentVersion.status,
            schema: asJsonObject(componentVersion.schema),
            metadata: asJsonObject(componentVersion.metadata),
            releasedAt: componentVersion.releasedAt,
            createdAt: componentVersion.createdAt,
            updatedAt: componentVersion.updatedAt,
            component: toComponentRecord(componentVersion.component),
        };
    }
    toPricingProgramVersionRecord(version) {
        return {
            id: version.id,
            pricingProgramId: version.pricingProgramId,
            version: version.version,
            status: version.status,
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
    toProductVersionComponentRefRecord(ref) {
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
