/**
 * Retry lazy dynamic imports after deploy or flaky mobile networks (chunk load failures).
 */
export async function loadWithRetry<T>(loader: () => Promise<T>, retries = 2, delayMs = 400): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    if (retries <= 0) {
      throw err;
    }
    await new Promise((r) => setTimeout(r, delayMs));
    return loadWithRetry(loader, retries - 1, delayMs + 300);
  }
}
