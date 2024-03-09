import type { Request, Response } from "express";
import type { PostalAddress, Tariff } from "@flat-peak/javascript-sdk";

export interface AppParams {
  api_url: string;
}

export type CredentialsResponse = {
  success: boolean;
  error: string;
  data: Record<string, unknown>;
};

export interface TariffResponse<T> {
  success?: boolean;
  error?: string;
  tariff: T;
  postal_address?: PostalAddress;
}

export interface ProviderHooks<T> {
  authorise: (
    credentials: NonNullable<unknown>,
  ) => Promise<CredentialsResponse>;
  capture: (reference: Record<string, unknown>) => Promise<TariffResponse<T>>;
  convert: (tariff: T) => Tariff & { reference_id?: string };
  logger?: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
}

export interface OnboardPage {
  view: string;
  title: string;
  params?:
    | Record<string, string>
    | ((req: Request, res: Response) => Promise<Record<string, string>>);
}

export type OnboardPages = Record<string, OnboardPage>;

/**
 * Configuration parameters passed to the `integrateProvider()` middleware.
 */
export interface ConfigParams<T> {
  pages: OnboardPages;
  appParams: AppParams;
  providerHooks: ProviderHooks<T>;
}

export type RenderRouteKey = keyof RenderRouteDataMapping;
export type ContractDirection = "IMPORT" | "EXPORT";
export type ProviderSummary = {
  id: string;
  display_name: string;
  logo_url: string;
  accent_color?: string;
};
export type AccountSummary = {
  display_name: string;
  privacy_url: string;
  terms_url: string;
};

export type RouteActionsMapping = {};

export type CommonRenderRoute<T extends RenderRouteKey = RenderRouteKey> = {
  route: T;
  connect_token: string;
  type: "render";
  live_mode: boolean;
  direction: ContractDirection;
  data: RenderRouteDataMapping[T];
  actions?: T extends keyof RouteActionsMapping
    ? Array<RouteActionsMapping[T]>
    : undefined;
};

export type HasProviderSummaryTrait = {
  provider: ProviderSummary;
};

export type HasAccountSummaryTrait = {
  account: AccountSummary;
};
export type AuthMetadataCapture = HasAccountSummaryTrait &
  HasProviderSummaryTrait;

export type RenderRouteDataMapping = {
  auth_metadata_capture: AuthMetadataCapture;
};
