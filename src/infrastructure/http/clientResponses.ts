export const readApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const requireOkResponse = async (
  response: Response,
  fallback: string,
): Promise<Response> => {
  if (!response.ok) throw new Error(await readApiErrorMessage(response, fallback));
  return response;
};
