import { apiRequest } from "./client";
import type {
  ComponentDto,
  ComponentType,
  ComponentVersionDto,
  PricingProgramDto,
  PricingProgramVersionDto,
  ProductDto,
  ProductVersionComponentRefDto,
  ProductVersionDto,
  ProductVersionSnapshotDto,
} from "./types";

export const productManagementApi = {
  listProducts: () => apiRequest<ReadonlyArray<ProductDto>>("/v1/product-management/products"),
  createProduct: (input: {
    productCode: string;
    name: string;
    description: string | null;
  }) => apiRequest<ProductDto>("/v1/product-management/products", {
    method: "POST",
    body: JSON.stringify(input),
  }),
  getProduct: (productId: string) => apiRequest<ProductDto>(`/v1/product-management/products/${productId}`),
  listProductVersions: (productId: string) =>
    apiRequest<ReadonlyArray<ProductVersionDto>>(`/v1/product-management/products/${productId}/versions`),
  createProductVersion: (
    productId: string,
    input: {
      effectiveFrom: string;
      effectiveTo: string | null;
      policySchema: Record<string, unknown>;
      exposureSchemas: Record<string, unknown>;
      pricingInputSchema: Record<string, unknown>;
      pricingProgramVersionId: string | null;
    },
  ) =>
    apiRequest<ProductVersionDto>(`/v1/product-management/products/${productId}/versions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getProductVersion: (productVersionId: string) =>
    apiRequest<ProductVersionDto>(`/v1/product-management/product-versions/${productVersionId}`),
  listProductVersionComponentRefs: (productVersionId: string) =>
    apiRequest<ReadonlyArray<ProductVersionComponentRefDto>>(
      `/v1/product-management/product-versions/${productVersionId}/components`,
    ),
  getProductVersionSnapshot: (productVersionId: string) =>
    apiRequest<ProductVersionSnapshotDto | null>(
      `/v1/product-management/product-versions/${productVersionId}/snapshot`,
    ),
  addProductVersionComponentRef: (
    productVersionId: string,
    input: { componentVersionId: string; configOverrides: Record<string, unknown> },
  ) =>
    apiRequest<ProductVersionComponentRefDto>(
      `/v1/product-management/product-versions/${productVersionId}/components`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  removeProductVersionComponentRef: (productVersionId: string, componentVersionId: string) =>
    apiRequest<{ deleted: boolean }>(
      `/v1/product-management/product-versions/${productVersionId}/components/${componentVersionId}`,
      {
        method: "DELETE",
      },
    ),
  activateProductVersion: (productVersionId: string) =>
    apiRequest(`/v1/product-management/product-versions/${productVersionId}/activate`, {
      method: "POST",
    }),
  retireProductVersion: (productVersionId: string) =>
    apiRequest(`/v1/product-management/product-versions/${productVersionId}/retire`, {
      method: "POST",
    }),

  listComponents: (type?: ComponentType) =>
    apiRequest<ReadonlyArray<ComponentDto>>(
      `/v1/product-management/components${type ? `?type=${type}` : ""}`,
    ),
  createComponent: (input: {
    componentCode: string;
    type: ComponentType;
    name: string;
    description: string | null;
  }) =>
    apiRequest<ComponentDto>("/v1/product-management/components", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getComponent: (componentId: string) =>
    apiRequest<ComponentDto>(`/v1/product-management/components/${componentId}`),
  listComponentVersions: (componentId: string) =>
    apiRequest<ReadonlyArray<ComponentVersionDto>>(
      `/v1/product-management/components/${componentId}/versions`,
    ),
  createComponentVersion: (
    componentId: string,
    input: { schema: Record<string, unknown>; metadata: Record<string, unknown>; status: string },
  ) =>
    apiRequest<ComponentVersionDto>(`/v1/product-management/components/${componentId}/versions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listPricingPrograms: () =>
    apiRequest<ReadonlyArray<PricingProgramDto>>("/v1/product-management/pricing-programs"),
  createPricingProgram: (input: {
    programCode: string;
    name: string;
    description: string | null;
  }) =>
    apiRequest<PricingProgramDto>("/v1/product-management/pricing-programs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getPricingProgram: (pricingProgramId: string) =>
    apiRequest<PricingProgramDto>(`/v1/product-management/pricing-programs/${pricingProgramId}`),
  listPricingProgramVersions: (pricingProgramId: string) =>
    apiRequest<ReadonlyArray<PricingProgramVersionDto>>(
      `/v1/product-management/pricing-programs/${pricingProgramId}/versions`,
    ),
  createPricingProgramVersion: (
    pricingProgramId: string,
    input: {
      fileRef: string;
      inputSchema: Record<string, unknown>;
      outputSchema: Record<string, unknown>;
      metadata: Record<string, unknown>;
      status: string;
    },
  ) =>
    apiRequest<PricingProgramVersionDto>(
      `/v1/product-management/pricing-programs/${pricingProgramId}/versions`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
};
