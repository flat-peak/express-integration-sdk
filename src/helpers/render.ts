import {
  Account,
  getDefaultLanguageAsset,
  Provider,
} from "@flat-peak/javascript-sdk";
import { Request, Response } from "express";
import { SharedState } from "../models/shared-state";
import { SharedStateData } from "../types";

/**
 * @return {Object}
 * @param props
 */
export function populateTemplate(props: {
  state: SharedState;
  account: Account;
  provider: Provider;
}) {
  const { state, account, provider } = props;
  const accountLanguageSettings = getDefaultLanguageAsset(
    account.display_settings,
  );
  const providerLanguageSettings = getDefaultLanguageAsset(
    provider.display_settings,
  );

  const { callback_url } = state.getData();
  return {
    callbackUrl: callback_url,

    Authorisation: state.getAuthorisation(),
    SharedState: state.toString(),
    PublicState: state.toPublic().toString(),

    ProviderDisplayName: providerLanguageSettings.display_name,
    ProviderPrivacyUrl: providerLanguageSettings.privacy_url,
    ProviderSupportUrl: providerLanguageSettings.support_url,
    ProviderTermsUrl: providerLanguageSettings.support_url,
    ProviderLogoUrl: providerLanguageSettings.logo_url,
    ProviderAccentColor:
      provider.display_settings?.graphic_assets?.accent_color || "#333333",

    ManufacturerDisplayName: accountLanguageSettings.display_name,
    ManufacturerTermsUrl: accountLanguageSettings.terms_url,
    ManufacturerPolicyUrl: accountLanguageSettings.privacy_url,
    ManufacturerLogoUrl: accountLanguageSettings.logo_url,
    ManufacturerAccentColor:
      account.display_settings?.graphic_assets?.accent_color || "#333333",
  };
}

export function respondWithError(req: Request, res: Response, error: string) {
  res.status(400).render("error", {
    title: "Error",
    error,
    callbackUrl: (res.locals.state as SharedState)?.getData().callback_url,
  });
}

export function respondWithRedirect(
  req: Request,
  res: Response,
  params: { uri?: string; auth?: string; state?: SharedStateData },
) {
  res.status(302).render("redirect", {
    title: "Redirect",
    params,
  });
}
