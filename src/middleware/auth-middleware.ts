import { FailureResponse, FlatpeakService } from "@flat-peak/javascript-sdk";
import { v4 as uuidv4 } from "uuid";
import { NextFunction, Request, Response } from "express";
import { decodeState } from "../helpers/state-validator";
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
    const inputState = req.query.state || req.body.state;

    if (!inputState) {
      res.status(400);
      return respondWithError(req, res, "Missing state");
    }

    let state = {} as SharedStateData;
    try {
      state = decodeState(inputState);
    } catch (e) {
      logger?.error(e instanceof Error ? e.message : "Unknown error");
      res.status(400);
      return respondWithError(req, res, "Failed to parse shared state");
    }

    if (!state.request_id) {
      state.request_id = uuidv4();
    }

    if (!state.publishable_key) {
      res.status(403);
      return respondWithError(req, res, "Missing publishable_key");
    }

    if (!state.session_id) {
      res.status(403);
      return respondWithError(req, res, "Missing session_id");
    }

    const flatpeak = new FlatpeakService(
      api_url,
      state.publishable_key,
      (message) => {
        if (logger) {
          logger.info(`[SERVICE] ${message}`);
        }
      },
    );

    const targetProviderId = provider_id;
    if (!targetProviderId) {
      return respondWithError(
        req,
        res,
        `Please ensure that you pass the 'provider_id' parameter through the state object for this integration.`,
      );
    }

    return Promise.all([
      flatpeak.accounts.current(),
      flatpeak.providers.retrieve(targetProviderId),
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
