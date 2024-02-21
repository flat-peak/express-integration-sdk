import { FailureResponse } from "@flat-peak/javascript-sdk";

export const throwIfError: <T>(request: Promise<T>) => Promise<T> = async (
  request,
) => {
  const result = await request;
  if ((result as FailureResponse).object === "error") {
    throw new Error((result as FailureResponse).message);
  }
  return result;
};
