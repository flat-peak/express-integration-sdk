import { Request, Response } from "express";
import { respondWithError } from "../helpers/render";

/**
 * Express JS middleware implementing error handling for Express web apps.
 */
export function errorHandler(err: Error, req: Request, res: Response) {
  respondWithError(req, res, err.message);
}
