import type { Request, Response } from "express";
import type { PostalAddress, Tariff } from "@flat-peak/javascript-sdk";

export interface AppParams {
  provider_id: string;
  api_url: string;
  logger: {
    log: (message: string) => void;
    info: (message: string) => void;
    error: (message: string) => void;
  };
}

export interface CredentialsReference {
  reference_id?: string;
  identification?: string;
}

export interface CredentialsResponse extends CredentialsReference {
  success: boolean;
  error: string;
}

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
  capture: (reference: CredentialsReference) => Promise<TariffResponse<T>>;
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

export interface OnboardPages {
  index: OnboardPage;
  auth: OnboardPage;
  share: OnboardPage;
  success: OnboardPage;
  cancel: OnboardPage;
}

/**
 * Configuration parameters passed to the `integrateProvider()` middleware.
 */
export interface ConfigParams<T> {
  pages: OnboardPages;
  appParams: AppParams;
  providerHooks: ProviderHooks<T>;
}

export interface SharedStateData {
  provider_id: string;
  product_id?: string;
  customer_id?: string;
  postal_address?: PostalAddress;
  geo_location?: [number, number];
  callback_url?: string;

  tariff_id?: string;
  request_id?: string;
  auth_metadata?: Record<string, unknown>;

  [key: string]: unknown;
}
