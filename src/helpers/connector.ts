import {
  Customer,
  FlatpeakService,
  PostalAddress,
  Product,
  Tariff,
  throwOnApiError,
} from "@flat-peak/javascript-sdk";
import { throwIfError } from "./util";
import type { AppParams, ProviderHooks, SharedStateData } from "../index";

interface InputParams<T> {
  publicKey: string;
  state: SharedStateData;
  tariff?: T;
  postal_address?: PostalAddress;
}

/**
 * @param {AppParams} appParams
 * @param {ProviderHooks} providerHooks
 * @param {InputParams} inputParams
 */
export async function connectTariff<T extends NonNullable<unknown>>(
  appParams: AppParams,
  providerHooks: ProviderHooks<T>,
  inputParams: InputParams<T>,
) {
  const {
    publicKey,
    state,
    tariff: providerTariff,
    postal_address,
  } = inputParams;

  const {
    customer_id,
    product_id,
    geo_location,
    postal_address: fallback_postal_address,
    provider_id: fallback_provider_id,
    auth_metadata,
  } = state;

  const { api_url, provider_id, logger } = appParams;
  const { convert } = providerHooks;

  const flatpeak = new FlatpeakService(api_url, publicKey, (message) => {
    if (logger) {
      logger.info(`[SERVICE] ${message}`);
    }
  });

  const tariffDraft = convert(providerTariff as T);
  const customer = (await throwOnApiError(
    customer_id
      ? flatpeak.customers.retrieve(customer_id)
      : flatpeak.customers.create({
          is_disabled: true,
        }),
  )) as Customer;
  let product = (await throwOnApiError(
    product_id
      ? flatpeak.products.retrieve(product_id)
      : flatpeak.products.create({
          customer_id: customer.id,
          provider_id: provider_id || fallback_provider_id,
          timezone: tariffDraft.timezone,
          is_disabled: true,
        }),
  )) as Product;
  tariffDraft.product_id = product.id;

  const tariff = (await throwIfError(
    flatpeak.tariffs.create(tariffDraft),
  )) as Tariff;

  const validGeoLocation =
    Array.isArray(geo_location) && geo_location.length === 2;

  const postalAddress = postal_address || fallback_postal_address;

  product = (await throwIfError(
    flatpeak.products.update(product.id, {
      tariff_settings: {
        reference_id: tariffDraft.reference_id,
        is_disabled: false,
        integrated: true,
        tariff_id: tariff.id,
        failed_attempts: 0,
        auth_metadata: {
          reference_id: tariffDraft.reference_id,
          data: auth_metadata,
        },
      },
      ...(tariff.contract_end_date && {
        contract_end_date: tariff.contract_end_date,
      }),
      ...(postalAddress && { postal_address: postalAddress }),
      ...(validGeoLocation && { geo_location }),
    }),
  )) as Product;

  return {
    customer_id: customer.id,
    product_id: product.id,
    tariff_id: tariff.id,
  };
}
