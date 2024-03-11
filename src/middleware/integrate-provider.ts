import { Router } from "express";
import { respondWithError, submitAction } from "../helpers/render";
import { createAuthMiddleware } from "./auth-middleware";
import { ConfigParams } from "../types";

/**
 * Express JS middleware implementing provider integration for Express web apps using FlatPeak API and given ProviderHooks.
 * Returns a router with the following routes:
 * [GET]  /
 * [POST] /action
 * [POST] /consent_capture
 * [POST] /auth_metadata_capture
 * [POST] /api/tariff_plan
 *
 * @param {ConfigParams} [params] The parameters object; see index.d.ts for types and descriptions.
 *
 * @return {Router} the router
 */
export function integrateProvider<T extends NonNullable<unknown>>(
  params: ConfigParams<T>,
): Router {
  const { pages, appParams, providerHooks } = params;
  const logger = providerHooks.logger || {
    info: console.log.bind(console),
    error: console.error.bind(console),
  };
  const router = Router();
  const authMiddleware = createAuthMiddleware(params);

  router.get("/", authMiddleware, async (req, res) => {
    const connectToken = req.query.fp_cot;
    return submitAction(
      {
        connect_token: connectToken,
        route: "start_tariff_integration",
      },
      appParams,
      pages,
      logger,
      req,
      res,
    );
  });

  router.post("/action", authMiddleware, async (req, res) => {
    const connectToken = req.query.fp_cot;
    const { route, action } = req.body;
    return submitAction(
      {
        route,
        type: "submit",
        connect_token: connectToken,
        action,
      },
      appParams,
      pages,
      logger,
      req,
      res,
    );
  });

  router.post("/auth_metadata_capture", authMiddleware, async (req, res) => {
    const connectToken = req.query.fp_cot;
    const { ...credentials } = req.body;

    const { success, error, data } = await providerHooks.authorise(credentials);

    if (error || !success) {
      // TODO: inline errors ?
      return respondWithError(req, res, error || "Authorisation failed");
    }

    return submitAction(
      {
        route: "auth_metadata_capture",
        connect_token: connectToken,
        data: { ...credentials, ...data },
      },
      appParams,
      pages,
      logger,
      req,
      res,
    );
  });

  router.post("/consent_capture", authMiddleware, (req, res) => {
    const connectToken = req.query.fp_cot;
    const { auth_metadata_id } = req.body;
    return submitAction(
      {
        route: "consent_capture",
        connect_token: connectToken,
        data: {
          auth_metadata_id,
          consent_given: true,
        },
      },
      appParams,
      pages,
      logger,
      req,
      res,
    );
  });

  router.post("/api/tariff_plan", (req, res) => {
    const { auth_metadata } = req.body;
    if (!auth_metadata || !auth_metadata.data) {
      if (logger) {
        logger.error(`Invalid auth_metadata ${JSON.stringify(auth_metadata)}`);
      }
      res.status(422);
      res.send({
        object: "error",
        type: "api_error",
        message: "Invalid credentials",
      });
      return;
    }
    const { data: credentials, reference_id } = auth_metadata;
    try {
      providerHooks
        .authorise(credentials)
        .then(({ error, ...reference }) => {
          if (error) {
            throw new Error(error);
          }
          return providerHooks.capture({
            ...reference,
            ...(reference_id && { reference_id }),
          });
        })
        .then(({ tariff, error }) => {
          if (error) {
            throw new Error(error);
          }
          res.send(providerHooks.convert(tariff));
        })
        .then((result) => res.send(result))
        .catch((e) => {
          if (logger) {
            logger.error(e);
          }
          res.status(400);
          res.send({
            object: "error",
            type: "api_error",
            message: e instanceof Error ? e.message : "Unknown error",
          });
        });
    } catch (e) {
      if (logger) {
        logger.error((e as Error).toString());
      }
      res.status(500);
      res.send({
        object: "error",
        type: "server_error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  });

  return router;
}
