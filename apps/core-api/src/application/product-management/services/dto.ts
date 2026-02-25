import type {
  ComponentRecord,
  ComponentVersionRecord,
  PricingProgramRecord,
  PricingProgramVersionRecord,
  ProductRecord,
  ProductVersionRecord,
  ProductVersionSnapshotRecord,
} from "../ports/repositories.js";

export interface ProductDto {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVersionDto {
  id: string;
  productId: string;
  version: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  policySchema: Record<string, unknown>;
  exposureSchemas: Record<string, unknown>;
  pricingInputSchema: Record<string, unknown>;
  pricingProgramVersionId: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVersionSnapshotDto {
  id: string;
  productVersionId: string;
  resolvedSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface ComponentDto {
  id: string;
  componentCode: string;
  type: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentVersionDto {
  id: string;
  componentId: string;
  version: number;
  status: string;
  schema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  component: ComponentDto;
}

export interface PricingProgramDto {
  id: string;
  programCode: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PricingProgramVersionDto {
  id: string;
  pricingProgramId: string;
  version: number;
  status: string;
  fileRef: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pricingProgram: PricingProgramDto;
}

export const toProductDto = (record: ProductRecord): ProductDto => ({
  id: record.id,
  productCode: record.productCode,
  name: record.name,
  description: record.description,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

export const toProductVersionDto = (record: ProductVersionRecord): ProductVersionDto => ({
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

export const toProductVersionSnapshotDto = (
  record: ProductVersionSnapshotRecord,
): ProductVersionSnapshotDto => ({
  id: record.id,
  productVersionId: record.productVersionId,
  resolvedSnapshot: structuredClone(record.resolvedSnapshot),
  createdAt: record.createdAt.toISOString(),
});

export const toComponentDto = (record: ComponentRecord): ComponentDto => ({
  id: record.id,
  componentCode: record.componentCode,
  type: record.type,
  name: record.name,
  description: record.description,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

export const toComponentVersionDto = (record: ComponentVersionRecord): ComponentVersionDto => ({
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

export const toPricingProgramDto = (record: PricingProgramRecord): PricingProgramDto => ({
  id: record.id,
  programCode: record.programCode,
  name: record.name,
  description: record.description,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

export const toPricingProgramVersionDto = (
  record: PricingProgramVersionRecord,
): PricingProgramVersionDto => ({
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
