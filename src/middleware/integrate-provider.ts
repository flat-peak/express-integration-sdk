import { Router } from "express";
import { connectTariff } from "../helpers/connector";
import {
  populateTemplate,
  respondWithError,
  respondWithRedirect,
} from "../helpers/render";
import { createAuthMiddleware } from "./auth-middleware";
import { ConfigParams } from "../types";
import { RequestLocals } from "../locals";

/**
 * Express JS middleware implementing provider integration for Express web apps using FlatPeak API and given ProviderHooks.
 * Returns a router with two routes /login and /callback
 *
 * @param {ConfigParams} [params] The parameters object; see index.d.ts for types and descriptions.
 *
 * @return {Router} the router
 */
export function integrateProvider<T extends NonNullable<unknown>>(
  params: ConfigParams<T>,
): Router {
  const { pages, appParams, providerHooks } = params;
  const { logger } = providerHooks;
  const router = Router();
  const authMiddleware = createAuthMiddleware(params);

  router.get("/", (req, res) => {
    return respondWithError(
      req,
      res,
      "Missing state. Use a POST request with state and auth params.",
    );
  });

  router.post("/", authMiddleware, (req, res) => {
    respondWithRedirect(req, res, {
      uri: "/auth",
      auth: req.body.auth,
      state: res.locals.state,
    });
  });

  router.post("/auth", authMiddleware, async (req, res) => {
    const extraParams = pages.auth.params;
    res.render(pages.auth.view, {
      title: pages.auth.title,
      ...populateTemplate(res.locals as RequestLocals),
      ...(pages.auth.params &&
        (typeof extraParams === "function"
          ? await extraParams(req, res)
          : extraParams)),
    });
  });

  router.post("/auth/capture", authMiddleware, (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { auth, state, ...credentials } = req.body;
    return providerHooks.authorise(credentials).then(({ success, error }) => {
      if (error || !success) {
        return respondWithError(req, res, error || "Authorisation failed");
      }

      return respondWithRedirect(req, res, {
        uri: "/share",
        auth: req.body.auth,
        state: res.locals.state.extend({ auth_metadata: credentials }),
      });
    });
  });

  router.post("/share", authMiddleware, async (req, res) => {
    if (!res.locals.state.getData().auth_metadata) {
      return respondWithRedirect(req, res, {
        uri: "/auth",
        auth: req.body.auth,
        state: res.locals.state,
      });
    }
    const extraParams = pages.share.params;

    return res.render("share", {
      title: "Share your tariff",
      ...populateTemplate(res.locals as RequestLocals),
      ...(pages.share.params &&
        (typeof extraParams === "function"
          ? await extraParams(req, res)
          : extraParams)),
    });
  });

  router.post("/share/capture", authMiddleware, (req, res) => {
    const stateData = res.locals.state.getData();
    const credentials = stateData.auth_metadata;
    if (!credentials) {
      return respondWithRedirect(req, res, {
        uri: "/auth",
        auth: req.body.auth,
        state: res.locals.state,
      });
    }

    try {
      return providerHooks
        .authorise(credentials, { state: stateData })
        .then(({ error, ...reference }) => {
          if (error) {
            throw new Error(error);
          }
          return providerHooks.capture(reference, { state: stateData });
        })
        .then(({ tariff, postal_address, error }) => {
          if (error) {
            throw new Error(error);
          }
          return connectTariff<T>(appParams, providerHooks, {
            publicKey: res.locals.state.getPublicKey(),
            state: stateData,
            tariff,
            postal_address,
          });
        })
        .then((result) => {
          res.locals.state.extend(result);
          res.render(pages.success.view, {
            title: pages.success.title,
            ...populateTemplate(res.locals as RequestLocals),
            ...result,
          });
        })
        .catch((e) => {
          if (logger) {
            logger.error(e);
          }
          respondWithError(
            req,
            res,
            e instanceof Error ? e.message : "Unknown error",
          );
        });
    } catch (e) {
      logger?.error((e as Error).toString());
      return respondWithError(
        req,
        res,
        e instanceof Error ? e.message : "Unknown error",
      );
    }
  });

  router.post("/cancel", authMiddleware, (req, res) => {
    respondWithError(req, res, "User rejects integration");
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
