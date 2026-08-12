export const mmConversion: Record<string, number> = {
  mm: 1,
  in: 25.4,
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
