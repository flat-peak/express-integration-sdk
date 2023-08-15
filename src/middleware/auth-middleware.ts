import { FailureResponse, FlatpeakService } from "@flat-peak/javascript-sdk";
import { v4 as uuidv4 } from "uuid";
import { NextFunction, Response, Request } from "express";
import { decodeState } from "../helpers/state-validator";
import { SharedState } from "../models/shared-state";
import { respondWithError } from "../helpers/render";
import { ConfigParams, SharedStateData } from "../types";

/**
 * Returns a middleware
 *
 * @param {ConfigParams} [params] The parameters object; see index.d.ts for types and descriptions.
 *
 * @return {function}
 */
export function createAuthMiddleware<T>(params: ConfigParams<T>) {
  const {
    appParams: { api_url, provider_id },
    providerHooks: { logger },
  } = params;
  return async (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.body.auth;
    const inputState = req.body.state;
    if (!authorization) {
      res.status(403);
      return respondWithError(req, res, "Missing authorization");
    }

    if (!inputState) {
      res.status(400);
      return respondWithError(req, res, "Missing state");
    }

    let rawStateInput = {} as SharedStateData;
    try {
      rawStateInput = decodeState(inputState);
    } catch (e) {
      logger?.error(e instanceof Error ? e.message : "Unknown error");
      res.status(400);
      return respondWithError(req, res, "Failed to parse shared state");
    }

    const state = new SharedState(rawStateInput, authorization, uuidv4());
    const flatpeak = new FlatpeakService(
      api_url,
      state.getPublicKey(),
      (message) => {
        if (logger) {
          logger.info(`[SERVICE] ${message}`);
        }
      },
    );

    return Promise.all([
      flatpeak.accounts.current(),
      flatpeak.providers.retrieve(provider_id || state.getData().provider_id),
    ])
      .then(([account, provider]) => {
        if (account.object === "error") {
          respondWithError(req, res, (account as FailureResponse).message);
          return;
        }
        if (provider.object === "error") {
          respondWithError(req, res, (provider as FailureResponse).message);
          return;
        }
        res.locals.state = state;
        res.locals.flatpeak = flatpeak;
        res.locals.account = account;
        res.locals.provider = provider;
        next();
      })
      .catch(() => {
        res.status(403);
        return respondWithError(req, res, "Invalid credentials");
      });
  };
}
