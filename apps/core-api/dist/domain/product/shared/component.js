import { DomainInvariantError } from "./errors.js";
export const assertValidComponentId = (componentId) => {
    if (componentId.trim().length === 0) {
        throw new DomainInvariantError("componentId must be non-empty");
    }
};
export const assertValidVersion = (version) => {
    if (!Number.isInteger(version) || version <= 0) {
        throw new DomainInvariantError("version must be a positive integer");
    }
};
export const assertDraftComponentEditable = (status) => {
    if (status === "released") {
        throw new DomainInvariantError("released component versions are immutable");
    }
};
export const assertReleasedTransition = (status) => {
    if (status === "released") {
        throw new DomainInvariantError("component version is already released");
    }
};
export const cloneJsonObject = (value) => {
    return structuredClone(value);
};
export const createEmptyOverrides = () => ({});
export const createComponentReference = (reference) => {
    assertValidComponentId(reference.componentId);
    assertValidVersion(reference.version);
    return {
        componentId: reference.componentId,
        version: reference.version,
        configOverrides: cloneJsonObject(reference.configOverrides ?? createEmptyOverrides()),
    };
};
