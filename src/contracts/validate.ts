import type { ZodTypeAny } from "zod";

export class ContractValidationError extends Error {
  public readonly issues: string[];

  public constructor(message: string, issues: string[]) {
    super(message);
    this.name = "ContractValidationError";
    this.issues = issues;
  }
}

export function validateContract<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  schemaName: string,
): ReturnType<TSchema["parse"]> {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    return `${path}: ${issue.message}`;
  });

  throw new ContractValidationError(
    `Invalid ${schemaName} contract`,
    issues,
  );
}
