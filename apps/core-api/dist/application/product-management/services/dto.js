export const toProductDto = (record) => ({
    id: record.id,
    productCode: record.productCode,
    name: record.name,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
});
export const toProductVersionDto = (record) => ({
    id: record.id,
    productId: record.productId,
    version: record.version,
    status: record.status,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo ? record.effectiveTo.toISOString() : null,
    policySchema: structuredClone(record.policySchema),
    exposureSchemas: structuredClone(record.exposureSchemas),
    pricingInputSchema: structuredClone(record.pricingInputSchema),
    pricingProgramVersionId: record.pricingProgramVersionId,
    activatedAt: record.activatedAt ? record.activatedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
});
export const toProductVersionSnapshotDto = (record) => ({
    id: record.id,
    productVersionId: record.productVersionId,
    resolvedSnapshot: structuredClone(record.resolvedSnapshot),
    createdAt: record.createdAt.toISOString(),
});
export const toComponentDto = (record) => ({
    id: record.id,
    componentCode: record.componentCode,
    type: record.type,
    name: record.name,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
});
export const toComponentVersionDto = (record) => ({
    id: record.id,
    componentId: record.componentId,
    version: record.version,
    status: record.status,
    schema: structuredClone(record.schema),
    metadata: structuredClone(record.metadata),
    releasedAt: record.releasedAt ? record.releasedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    component: toComponentDto(record.component),
});
export const toPricingProgramDto = (record) => ({
    id: record.id,
    programCode: record.programCode,
    name: record.name,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
});
export const toPricingProgramVersionDto = (record) => ({
    id: record.id,
    pricingProgramId: record.pricingProgramId,
    version: record.version,
    status: record.status,
    fileRef: record.fileRef,
    inputSchema: structuredClone(record.inputSchema),
    outputSchema: structuredClone(record.outputSchema),
    metadata: structuredClone(record.metadata),
    releasedAt: record.releasedAt ? record.releasedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    pricingProgram: toPricingProgramDto(record.pricingProgram),
});
