export interface ResolveWithTimeoutOptions<T> {
  fallback: T;
  timeoutMs: number;
}

export const resolveWithTimeout = async <T>(
  promise: Promise<T>,
  { fallback, timeoutMs }: ResolveWithTimeoutOptions<T>
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise.catch(() => fallback),
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
