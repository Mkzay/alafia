export type DataErrorCode = 'validation' | 'storage' | 'not_found';

export interface ValidationIssue {
  path: string;
  message: string;
}

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly issues: ValidationIssue[];

  constructor(code: DataErrorCode, message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = 'DataError';
    this.code = code;
    this.issues = issues;
  }
}

export function isDataError(error: unknown): error is DataError {
  return error instanceof DataError;
}
