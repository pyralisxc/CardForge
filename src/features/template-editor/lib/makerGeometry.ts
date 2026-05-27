export const mmConversion: Record<string, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  px96: 25.4 / 96,
  px300: 25.4 / 300,
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
