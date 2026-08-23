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

export class AsyncTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation did not complete within ${timeoutMs} ms.`);
    this.name = 'AsyncTimeoutError';
  }
}

export const resolveWithTimeoutOrThrow = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new AsyncTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
