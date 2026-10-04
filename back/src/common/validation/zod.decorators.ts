import { Body, Param, Query } from '@nestjs/common';
import { ApiBody, ApiParam, ApiQuery, type SchemaObject } from '@nestjs/swagger';
import { idSchema } from '@market/shared';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/** JSON Schema (OpenAPI 3.0 flavour) of the *input* side of a Zod schema, for Swagger. */
export function toOpenApiSchema(schema: z.ZodType): SchemaObject {
  const json = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  delete json.$schema;
  return json as SchemaObject;
}

function applyMethodDecorator(
  target: object,
  key: string | symbol | undefined,
  decorator: MethodDecorator,
): void {
  if (key === undefined) return;
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor) decorator(target, key, descriptor);
}

/** `@ZodBody(schema) body: Output` - validates the body and documents it in Swagger. */
export function ZodBody(schema: z.ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodValidationPipe(schema))(target, key, index);
    applyMethodDecorator(target, key, ApiBody({ schema: toOpenApiSchema(schema) }));
  };
}

/** `@ZodQuery(schema) query: Output` - validates the query string and documents every parameter. */
export function ZodQuery(schema: z.ZodType): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodValidationPipe(schema))(target, key, index);
    const json = toOpenApiSchema(schema);
    const properties = (json.properties ?? {}) as Record<string, SchemaObject>;
    const required = new Set(json.required ?? []);
    for (const [name, prop] of Object.entries(properties)) {
      applyMethodDecorator(
        target,
        key,
        ApiQuery({ name, required: required.has(name), schema: prop }),
      );
    }
  };
}

/** UUID route parameter. */
export function UuidParam(name = 'id'): ParameterDecorator {
  return (target, key, index) => {
    Param(name, new ZodValidationPipe(idSchema))(target, key, index);
    applyMethodDecorator(target, key, ApiParam({ name, format: 'uuid', type: String }));
  };
}
