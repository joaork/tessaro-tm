// GitHub https://github.com/joaork

import type { z } from 'zod';
import type { Issue } from '../shared/contracts';

export class AppError extends Error {
  constructor(message: string, readonly statusCode: number, readonly issues?: Issue[]) {
    super(message);
  }
}

export function schemaIssues(error: z.ZodError, line?: number): Issue[] {
  return error.issues.map((issue) => ({ line, field: issue.path.join('.'), message: issue.message }));
}

export function checked<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('Revise os campos indicados.', 422, schemaIssues(result.error));
  }
  return result.data;
}
