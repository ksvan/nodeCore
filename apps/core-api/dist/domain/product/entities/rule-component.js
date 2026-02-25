import { assertDraftComponentEditable, assertReleasedTransition, assertValidComponentId, assertValidVersion, cloneJsonObject, } from "../shared/component.js";
export const createRuleComponentDraft = (input) => {
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
export const updateRuleComponentDraftDefinition = (component, definition) => {
    assertDraftComponentEditable(component.status);
    return {
        ...component,
        definition: cloneJsonObject(definition),
    };
};
export const releaseRuleComponent = (component, releasedAt = new Date()) => {
    assertReleasedTransition(component.status);
    return {
        ...component,
        status: "released",
        releasedAt,
    };
};
