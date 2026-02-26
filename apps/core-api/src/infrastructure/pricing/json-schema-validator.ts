import { z, type ZodType } from "zod";

type JsonSchemaObject = Record<string, unknown>;

const fallbackSchema = z.unknown();

const resolveStringSchema = (schema: JsonSchemaObject): ZodType<unknown> => {
  const enumValues = schema.enum;
  if (Array.isArray(enumValues) && enumValues.every((value) => typeof value === "string")) {
    return z.enum(enumValues as [string, ...string[]]);
  }
  return z.string();
};

const resolveNumberSchema = (schema: JsonSchemaObject): ZodType<unknown> => {
  const isInteger = schema.type === "integer";
  return isInteger ? z.number().int() : z.number();
};

const buildZodFromJsonSchema = (schema: unknown): ZodType<unknown> => {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return fallbackSchema;
  }

  const schemaObject = schema as JsonSchemaObject;
  const type = schemaObject.type;

  if (type === "object" || ("properties" in schemaObject && typeof schemaObject.properties === "object")) {
    const properties = (schemaObject.properties ?? {}) as Record<string, unknown>;
    const required = new Set(
      Array.isArray(schemaObject.required)
        ? schemaObject.required.filter((item): item is string => typeof item === "string")
        : [],
    );

    const shape: Record<string, ZodType<unknown>> = {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      const propertyValidator = buildZodFromJsonSchema(propertySchema);
      shape[key] = required.has(key) ? propertyValidator : propertyValidator.optional();
    }
    return z.object(shape).passthrough();
  }

  if (type === "array") {
    const itemSchema = buildZodFromJsonSchema(schemaObject.items);
    return z.array(itemSchema);
  }

  if (type === "string") {
    return resolveStringSchema(schemaObject);
  }

  if (type === "number" || type === "integer") {
    return resolveNumberSchema(schemaObject);
  }

  if (type === "boolean") {
    return z.boolean();
  }

  if (type === "null") {
    return z.null();
  }

  return fallbackSchema;
};

export const validateWithJsonSchema = (schema: unknown, value: unknown): { ok: true } | { ok: false; error: string } => {
  const validator = buildZodFromJsonSchema(schema);
  const parsed = validator.safeParse(value);
  if (parsed.success) {
    return { ok: true };
  }
  const firstIssue = parsed.error.issues.at(0);
  return {
    ok: false,
    error: firstIssue ? `${firstIssue.path.join(".") || "value"}: ${firstIssue.message}` : "Invalid payload",
  };
};
