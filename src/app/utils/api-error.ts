/** Extract a user-facing message from an Angular HttpClient error response. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const err = error as { error?: { message?: string; error?: string }; message?: string };
  return err.error?.message || err.error?.error || err.message || fallback;
}
