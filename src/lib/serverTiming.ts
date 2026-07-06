export interface ServerTimingSegment {
  name: string;
  durationMs: number;
}

const normalizeTimingName = (name: string) => (
  name.trim().replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 64) || 'segment'
);

export function formatServerTimingHeader(segments: ServerTimingSegment[]): string {
  return segments
    .filter((segment) => Number.isFinite(segment.durationMs))
    .map((segment) => `${normalizeTimingName(segment.name)};dur=${Math.max(0, segment.durationMs).toFixed(1)}`)
    .join(', ');
}

export function createServerTimingTracker() {
  const segments: ServerTimingSegment[] = [];

  return {
    async track<T>(name: string, task: () => Promise<T>): Promise<T> {
      const startedAt = performance.now();
      try {
        return await task();
      } finally {
        segments.push({ name, durationMs: performance.now() - startedAt });
      }
    },
    add(name: string, durationMs: number) {
      segments.push({ name, durationMs });
    },
    segments() {
      return [...segments];
    },
    header() {
      return formatServerTimingHeader(segments);
    },
  };
}
