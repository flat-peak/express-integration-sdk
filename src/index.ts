import { integrateProvider } from "./middleware/integrate-provider";
import { errorHandler } from "./middleware/error-handler";
import { respondWithError, populateTemplate } from "./helpers/render";
import { createAuthMiddleware } from "./middleware/auth-middleware";

export * from "./types";
export * from "./locals";

export {
  integrateProvider,
  errorHandler,
  respondWithError,
  populateTemplate,
  createAuthMiddleware,
};
