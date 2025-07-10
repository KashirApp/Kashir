// Utility function to extract error messages from various error types
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const anyError = error as any;
    // Try CDK-specific error format first
    if (anyError.inner?.msg) {
      return anyError.inner.msg;
    }
    // Try standard message property
    if (anyError.message) {
      return anyError.message;
    }
  }

  return String(error);
};
