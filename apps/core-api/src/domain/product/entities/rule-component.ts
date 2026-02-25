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

export type RuleComponent = VersionedComponent;

interface CreateRuleComponentInput {
  readonly componentId: string;
  readonly version: number;
  readonly definition: JsonObject;
  readonly metadata: ComponentMetadata;
  readonly createdAt?: Date;
}

export const createRuleComponentDraft = (input: CreateRuleComponentInput): RuleComponent => {
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

export const updateRuleComponentDraftDefinition = (
  component: RuleComponent,
  definition: JsonObject,
): RuleComponent => {
  assertDraftComponentEditable(component.status);

  return {
    ...component,
    definition: cloneJsonObject(definition),
  };
};

export const releaseRuleComponent = (
  component: RuleComponent,
  releasedAt: Date = new Date(),
): RuleComponent => {
  assertReleasedTransition(component.status);

  return {
    ...component,
    status: "released",
    releasedAt,
  };
};
