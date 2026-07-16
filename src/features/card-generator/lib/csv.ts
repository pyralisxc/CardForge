import Papa from 'papaparse';

export const parseCSV = (raw: string): string[][] => {
  const result = Papa.parse<string[]>(raw, {
    skipEmptyLines: 'greedy',
    transform: (value) => value.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.message).join('; '));
  }

  return result.data.filter((row) => row.some((field) => field.trim() !== ''));
};

export const unparseCSV = (rows: Array<Array<string | number | null | undefined>>): string => (
  Papa.unparse(rows, { newline: '\n' })
);
