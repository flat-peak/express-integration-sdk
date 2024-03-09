import { NextFunction, Request, Response } from "express";
import { respondWithError } from "../helpers/render";
import { ConfigParams } from "../types";

/**
 * Returns a middleware
 *
 * @param {ConfigParams} [params] The parameters object;
 *
 * @return {function}
 */
export function createAuthMiddleware<T>(params: ConfigParams<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.query.fp_cot) {
      res.status(401);
      return respondWithError(req, res, "Missing connect_token");
    }
    next();
  };
}
