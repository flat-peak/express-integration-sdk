import {throwIfError} from './util';
import {FlatpeakService} from '@flat-peak/javascript-sdk';

/**
 * @param {AppParams} appParams
 * @param {ProviderHooks} providerHooks
 * @param {Object} credentials
 * @param {InputParams} inputParams
 */
export async function connectTariff( appParams, providerHooks, credentials, inputParams) {
  const {publishable_key, customer_id, product_id, tariff: providerTariff, postal_address} = inputParams;
  const {api_url, provider_id, logger} = appParams;
  const {convert} = providerHooks;

  const service = new FlatpeakService(api_url, publishable_key, (message) => {
    if (logger) {
      logger.info(`[SERVICE] ${message}`);
    }
  });

  const tariffDraft = /** @type {Tariff} */ convert(providerTariff);
  const customer = await throwIfError((customer_id ? service.getCustomer(customer_id) : service.createCustomer({
    is_disabled: true,
  })));
  let product = await throwIfError((product_id ? service.getProduct(product_id) : service.createProduct({
    customer_id: customer.id,
    provider_id: provider_id,
    timezone: tariffDraft.timezone,
    is_disabled: true,
  })));
  tariffDraft.product_id = product.id;

  const tariff = await throwIfError(service.createTariff(tariffDraft));

  product = await throwIfError(service.updateProduct(product.id, {
    'tariff_settings': {
      'reference_id': tariffDraft.reference_id,
      'display_name': tariff.display_name,
      'is_disabled': false,
      'integrated': true,
      'tariff_id': tariff.id,
      'auth_metadata': {
        'reference_id': tariffDraft.reference_id,
        'data': credentials,
      },
    },
    ...(postal_address && {postal_address: postal_address}),
  }));

  return {
    customer_id: customer.id,
    product_id: product.id,
    tariff_id: tariff.id,
  };
};
