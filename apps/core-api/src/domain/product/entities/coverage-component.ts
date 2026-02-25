import {
  assertDraftComponentEditable,
  assertReleasedTransition,
  assertValidComponentId,
  assertValidVersion,
  cloneJsonObject,
  type ComponentMetadata,
  type VersionedComponent,
  type JsonObject,
} from "../shared/component.js";

export type CoverageComponent = VersionedComponent;

interface CreateCoverageComponentInput {
  readonly componentId: string;
  readonly version: number;
  readonly definition: JsonObject;
  readonly metadata: ComponentMetadata;
  readonly createdAt?: Date;
}

export const createCoverageComponentDraft = (
  input: CreateCoverageComponentInput,
): CoverageComponent => {
  assertValidComponentId(input.componentId);
  assertValidVersion(input.version);

  return {
    componentId: input.componentId,
    version: input.version,
    status: "draft",
    definition: cloneJsonObject(input.definition),
    metadata: structuredClone(input.metadata),
    createdAt: input.createdAt ?? new Date(),
    releasedAt: null,
  };
};

export const updateCoverageComponentDraftDefinition = (
  component: CoverageComponent,
  definition: JsonObject,
): CoverageComponent => {
  assertDraftComponentEditable(component.status);

  return {
    ...component,
    definition: cloneJsonObject(definition),
  };
};

export const releaseCoverageComponent = (
  component: CoverageComponent,
  releasedAt: Date = new Date(),
): CoverageComponent => {
  assertReleasedTransition(component.status);

  return {
    ...component,
    status: "released",
    releasedAt,
  };
};
