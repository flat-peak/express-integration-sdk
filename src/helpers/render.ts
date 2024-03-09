import { Request, Response } from "express";
import {
  AppParams,
  HasAccountSummaryTrait,
  HasProviderSummaryTrait,
  OnboardPages,
} from "../types";

export function respondWithError(req: Request, res: Response, error: string) {
  res.status(400).render("error", {
    title: "Error",
    error,
  });
}

export async function respondToAction(
  action: {
    connect_token: string;
    route: string;
    data: HasProviderSummaryTrait &
      HasAccountSummaryTrait &
      Record<string, unknown>;
  },
  pages: OnboardPages,
  logger: { info: (message: string) => void },
  req: Request,
  res: Response,
): Promise<void> {
  logger.info(`<- router: ${JSON.stringify(action)}`);
  const { connect_token, route, data } = action;

  const { account, provider, ...extras } = data || {};

  if (route === "session_redirect") {
    const { redirect_uri } = data;
    return res.redirect(redirect_uri as string);
  }

  const page = pages[route];
  if (!page) {
    throw new Error(`Unsupported route - ${route}`);
  }
  const extraParams = page.params;
  return res.render(page.view, {
    title: page.title,
    route,
    connect_token,
    account,
    provider,
    accent_color: provider?.accent_color || "#333333",
    ...extras,
    ...(page.params &&
      (typeof extraParams === "function"
        ? await extraParams(req, res)
        : extraParams)),
  });
}

export const submitAction = async (
  payload: Record<string, unknown>,
  appParams: AppParams,
  pages: OnboardPages,
  logger: { info: (message: string) => void },
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    logger.info(`-> integration: ${JSON.stringify(payload)}`);
    const actionResponse = await fetch(`${appParams.api_url}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const actionData = await actionResponse.json();
    if (!actionResponse.ok) {
      throw new Error(actionData.message || "Fail to submit an action");
    }
    await respondToAction(actionData, pages, logger, req, res);
  } catch (error) {
    respondWithError(
      req,
      res,
      (error as Error).message || "Something went wrong",
    );
  }
};
