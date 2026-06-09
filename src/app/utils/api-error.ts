/** Extract a user-facing message from an Angular HttpClient error response. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const err = error as {
    status?: number;
    error?: { message?: string; error?: string; errorCode?: string } | string;
    message?: string;
  };

  const body = err.error;
  const bodyMessage =
    typeof body === 'object' && body !== null
      ? body.message || body.error
      : typeof body === 'string' && !body.trimStart().startsWith('<')
        ? body
        : undefined;

  switch (err.status) {
    case 401:
      return bodyMessage || 'Session expired. Please sign in again.';
    case 403:
      return bodyMessage || 'You do not have permission to access this feature.';
    case 404:
      return bodyMessage || 'This feature is not deployed on the server yet. Try again after the backend finishes deploying.';
    case 500:
    case 502:
    case 503:
      return bodyMessage || 'Server error. Please try again later.';
    default:
      break;
  }

  if (bodyMessage) {
    return bodyMessage;
  }

  // Avoid surfacing Angular's generic "Http failure response for …: 404 OK" string.
  const raw = err.message || '';
  if (/^Http failure response for /i.test(raw)) {
    return fallback;
  }

  return raw || fallback;
}
