export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  if (typeof error === 'string' && error.trim().length > 0) return error;
  return 'An unexpected error occurred.';
};

export const withNextStep = (message: string, nextStep: string): string => {
  return `${message} Next step: ${nextStep}`;
};
