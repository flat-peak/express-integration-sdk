export const throwIfError = async (request) => {
  const result = await request;
  if (result.object === 'error') {
    throw new Error(result.message);
  }
  return result;
};
