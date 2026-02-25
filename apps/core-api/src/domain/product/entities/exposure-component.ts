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

export type ExposureComponent = VersionedComponent;

interface CreateExposureComponentInput {
  readonly componentId: string;
  readonly version: number;
  readonly definition: JsonObject;
  readonly metadata: ComponentMetadata;
  readonly createdAt?: Date;
}

export const createExposureComponentDraft = (
  input: CreateExposureComponentInput,
): ExposureComponent => {
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

export const updateExposureComponentDraftDefinition = (
  component: ExposureComponent,
  definition: JsonObject,
): ExposureComponent => {
  assertDraftComponentEditable(component.status);

  return {
    ...component,
    definition: cloneJsonObject(definition),
  };
};

export const releaseExposureComponent = (
  component: ExposureComponent,
  releasedAt: Date = new Date(),
): ExposureComponent => {
  assertReleasedTransition(component.status);

  return {
    ...component,
    status: "released",
    releasedAt,
  };
};
