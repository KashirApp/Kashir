export const AMBER_PACKAGE = 'com.greenart7c3.nostrsigner';

export function createAmberUrl(data: any): string {
  return `nostrsigner:${encodeURIComponent(JSON.stringify(data))}`;
}

export function createAmberErrorMessage(
  operation: string,
  error: unknown
): string {
  return `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`;
}
