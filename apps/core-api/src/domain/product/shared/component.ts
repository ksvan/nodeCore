import { DomainInvariantError } from "./errors.js";

export type ComponentStatus = "draft" | "released";
export type JsonObject = Record<string, unknown>;

export interface ComponentMetadata {
  readonly name: string;
  readonly description?: string;
  readonly tags?: ReadonlyArray<string>;
}

export interface VersionedComponent {
  readonly componentId: string;
  readonly version: number;
  readonly status: ComponentStatus;
  readonly definition: JsonObject;
  readonly metadata: ComponentMetadata;
  readonly createdAt: Date;
  readonly releasedAt: Date | null;
}

export interface ComponentReference {
  readonly componentId: string;
  readonly version: number;
  readonly configOverrides: JsonObject;
}

export const assertValidComponentId = (componentId: string): void => {
  if (componentId.trim().length === 0) {
    throw new DomainInvariantError("componentId must be non-empty");
  }
};

export const assertValidVersion = (version: number): void => {
  if (!Number.isInteger(version) || version <= 0) {
    throw new DomainInvariantError("version must be a positive integer");
  }
};

export const assertDraftComponentEditable = (status: ComponentStatus): void => {
  if (status === "released") {
    throw new DomainInvariantError("released component versions are immutable");
  }
};

export const assertReleasedTransition = (status: ComponentStatus): void => {
  if (status === "released") {
    throw new DomainInvariantError("component version is already released");
  }
};

export const cloneJsonObject = <T extends JsonObject>(value: T): T => {
  return structuredClone(value);
};

export const createEmptyOverrides = (): JsonObject => ({});

export const createComponentReference = (reference: {
  componentId: string;
  version: number;
  configOverrides?: JsonObject;
}): ComponentReference => {
  assertValidComponentId(reference.componentId);
  assertValidVersion(reference.version);

  return {
    componentId: reference.componentId,
    version: reference.version,
    configOverrides: cloneJsonObject(reference.configOverrides ?? createEmptyOverrides()),
  };
};
