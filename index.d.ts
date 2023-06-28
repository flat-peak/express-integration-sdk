import {RequestHandler} from 'express';
import {FlatPeak} from "@flat-peak/javascript-sdk";

interface InputParams<T> {
	publishable_key: string;
	product_id: string;
	customer_id: string;
	callback_url: string;
	tariff?: T;
	postal_address?: FlatPeak.PostalAddress;
}

interface AppParams {
	provider_id: string;
	api_url: string;
}

interface CredentialsReference {
	reference_id?: string;
	identification?: string;
}

interface CredentialsResponse extends CredentialsReference {
	success: boolean;
	error: string;
}

interface TariffResponse<T> {
	success?: boolean;
	error?: string;
	tariff: T
}

interface ProviderHooks<T> {
	authorise: (credentials: Object) => Promise<CredentialsResponse>;
	capture: (reference: CredentialsReference) => Promise<TariffResponse<T>>;
	convert: (tariff: T) => Promise<FlatPeak.Tariff>;
	logger?: {
		info: (message: string) => void;
		error: (message: string) => void;
	}
}

interface OnboardPage {
	view: string;
	title: string;
}

interface OnboardPages {
	index: OnboardPage;
	auth: OnboardPage;
	share: OnboardPage;
	success: OnboardPage;
	cancel: OnboardPage;
}

/**
 * Configuration parameters passed to the `integrateProvider()` middleware.
 */
interface ConfigParams<T> {
	pages: OnboardPages;
	appParams: AppParams;
	providerHooks: ProviderHooks<T>;
}

/**
 * Express JS middleware implementing provider integration for Express web apps using FlatPeak API and given ProviderHooks.
 */
export function integrateProvider<T>(params?: ConfigParams<T>): RequestHandler;

/**
 * Express JS middleware implementing error handling for Express web apps.
 */
export const errorHandler: RequestHandler;
