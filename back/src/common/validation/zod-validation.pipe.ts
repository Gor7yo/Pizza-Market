import { type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppException } from '../errors/app.exception';

export function zodErrorToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.') || '_';
    fields[path] ??= issue.message;
  }
  return fields;
}

/**
 * Validates and transforms input with a shared Zod schema.
 * Unknown keys are rejected by strict schemas (protection against mass assignment).
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw AppException.badRequest(
        'VALIDATION_ERROR',
        'Validation failed',
        zodErrorToFields(result.error),
      );
    }
    return result.data;
  }
}
