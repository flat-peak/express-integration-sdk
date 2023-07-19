import { Router } from 'express';
import { FlatpeakService } from '@flat-peak/javascript-sdk';

const throwIfError = async (request) => {
  const result = await request;
  if (result.object === 'error') {
    throw new Error(result.message);
  }
  return result;
};

/**
 * @param {AppParams} appParams
 * @param {ProviderHooks} providerHooks
 * @param {Object} credentials
 * @param {InputParams} inputParams
 */
async function connectTariff( appParams, providerHooks, credentials, inputParams) {
  const {
    publishable_key,
    customer_id,
    product_id,
    tariff: providerTariff,
    postal_address,
    provider_id: requested_provider_id,
  } = inputParams;
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
    provider_id: provider_id || requested_provider_id,
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
}

/**
 * @param {DisplaySettings} display_settings
 * @return {LanguageAsset}
 */

function extractLanguageAssets(display_settings) {
  const hasAccountAssets = Array.isArray(display_settings?.language_assets) && display_settings?.language_assets.length;
  return hasAccountAssets ?
    (
      display_settings.language_assets
          .find((entry) => entry.language_code === display_settings.default_language) ||
      display_settings.language_assets[0]
    ) :
  {};
}

/**
 * @param {string} last_error
 * @param {string} callback_url
 * @param {Account} account
 * @param {Provider} provider
 * @return {Object}
 */
function populateTemplate({last_error, callback_url, account, provider}) {
  const accountLanguageSettings = extractLanguageAssets(account.display_settings);
  const providerLanguageSettings = extractLanguageAssets(provider.display_settings);

  return {
    lastError: last_error,
    callbackUrl: callback_url,

    ProviderDisplayName: providerLanguageSettings.display_name,
    ProviderPrivacyUrl: providerLanguageSettings.privacy_url,
    ProviderSupportUrl: providerLanguageSettings.support_url,
    ProviderTermsUrl: providerLanguageSettings.support_url,
    ProviderLogoUrl: providerLanguageSettings.logo_url,
    ProviderAccentColor: provider.display_settings?.graphic_assets?.accent_color || '#333333',

    ManufacturerDisplayName: accountLanguageSettings.display_name,
    ManufacturerTermsUrl: accountLanguageSettings.terms_url,
    ManufacturerPolicyUrl: accountLanguageSettings.privacy_url,
    ManufacturerLogoUrl: accountLanguageSettings.logo_url,
    ManufacturerAccentColor: account.display_settings?.graphic_assets?.accent_color || '#333333',
  };
}

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {AppParams} appParams
 * @param {ProviderHooks} providerHooks
 * @param {InputParams} inputParams
 */
function captureInputParams(req, res, appParams, providerHooks, inputParams) {
  const {api_url, provider_id} = appParams;
  const {logger} = providerHooks;
  const {publishable_key, product_id, customer_id, callback_url, provider_id: requested_provider_id} = inputParams;

  if (!publishable_key) {
    respondWithError(req, res, 'Publishable key is required to proceed');
    return;
  }

  const service = new FlatpeakService(api_url, publishable_key, (message) => {
    if (logger) {
      logger.info(`[SERVICE] ${message}`);
    }
  },
  );

  Promise.all([
    service.getAccount(),
    service.getProvider(provider_id || requested_provider_id),
  ]).then(([account, provider]) => {
    if (account.object === 'error') {
      respondWithError(req, res, account.message);
      return;
    }
    if (provider.object === 'error') {
      respondWithError(req, res, provider.message);
      return;
    }
    req.session.last_error = '';
    req.session.account = account;
    req.session.provider = provider;
    req.session.publishable_key = publishable_key;
    req.session.product_id = product_id;
    req.session.customer_id = customer_id;
    req.session.callback_url = callback_url;
    res.redirect('/auth');
  });
}

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {ProviderHooks} providerHooks
 * @param {InputParams} credentials
 */
function captureAuthMetaData(req, res, providerHooks, credentials) {
  providerHooks
      .authorise(credentials)
      .then(({success, error, ...rest}) => {
        if (error || !success) {
          req.session.last_error = error || 'Authorisation failed';
          res.redirect('/auth');
          return;
        }
        req.session.last_error = '';
        req.session.auth_metadata = credentials;
        res.redirect('/share');
      });
}

function respondWithError(req, res, error) {
  req.session.destroy();
  res.render('error', {
    title: 'Error',
    error: error,
    callbackUrl: req.session?.callback_url,
  });
}

/**
 * Returns a router with two routes /login and /callback
 *
 * @param {ConfigParams} [params] The parameters object; see index.d.ts for types and descriptions.
 *
 * @return {express.Router} the router
 */
function integrateProvider(params) {
  const {pages, appParams, providerHooks} = params;
  const {logger} = providerHooks;
  const router = new Router();

  router.get('/', function(req, res, next) {
    const {
      'publishable-key': publishable_key,
      'product-id': product_id,
      'provider-id': provider_id,
      'customer-id': customer_id,
      'callback-url': callback_url,
    } = req.headers;
    if (publishable_key) { // capture input params from headers
      return captureInputParams(req, res, appParams, providerHooks, {
        publishable_key, product_id, provider_id, customer_id, callback_url,
      });
    }
    // capture input params from javascript context
    res.render(pages.index.view, {
      title: pages.index.title,
      ...(pages.index.hasOwnProperty('params') && pages.index.params),
    });
  });

  // capture input params from POST payload
  router.post('/', function(req, res, next) {
    const {publishable_key: publishable_key, product_id, provider_id, customer_id, callback_url} = req.body;
    captureInputParams(req, res, appParams, providerHooks, {publishable_key, product_id, provider_id, customer_id, callback_url});
  });

  router.get('/auth', async function(req, res, next) {
    if (!req.session || !req.session.account || !req.session.provider) {
      req.session.destroy();
      res.redirect('/');
      return;
    }

    const sessionData = {...req.session};
    req.session.last_error = undefined; // Clear error

    res.render(pages.auth.view, {
      title: pages.auth.title,
      ...populateTemplate(sessionData),
      ...(pages.auth.hasOwnProperty('params') &&
          (
            typeof pages.auth.params === 'function' ?
              await pages.auth.params(req) :
              pages.auth.params
          )
      ),
    });
  });

  router.post('/auth', function(req, res, next) {
    if (!req.session || !req.session.account) {
      res.redirect('/');
      return;
    }
    captureAuthMetaData(req, res, providerHooks, req.body);
  });

  router.get('/share', async function(req, res, next) {
    if (!req.session || !req.session.account) {
      res.redirect('/');
      return;
    }
    if (!req.session.auth_metadata) {
      res.redirect('/auth');
      return;
    }
    res.render('share', {
      title: 'Share your tariff',
      ...populateTemplate(req.session),
      ...(pages.share.hasOwnProperty('params') &&
        (
          typeof pages.share.params === 'function' ?
            await pages.share.params(req) :
            pages.share.params
        )
      ),
    });
  });

  router.post('/share', function(req, res, next) {
    if (!req.session || !req.session.account) {
      res.redirect('/');
      return;
    }
    if (!req.session.auth_metadata) {
      res.redirect('/auth');
      return;
    }

    const {auth_metadata: credentials, publishable_key: publishable_key, product_id, provider, customer_id, callback_url} = req.session;

    try {
      providerHooks
          .authorise(credentials)
          .then(({error, ...reference}) => {
            if (error) {
              throw new Error(error);
            }
            return providerHooks.capture(reference);
          })
          .then(({tariff, postal_address, error}) => {
            if (error) {
              throw new Error(error);
            }
            return connectTariff(appParams, providerHooks, credentials, {
              publishable_key,
              product_id,
              provider_id: provider.id,
              customer_id,
              callback_url,
              tariff,
              postal_address,
            });
          })
          .then((result) => {
            res.render(pages.success.view, {
              title: pages.success.title,
              ...populateTemplate(req.session),
              ...result,
            });
          })
          .catch((e) => {
            if (logger) {
              logger.error(e);
            }
            respondWithError(req, res, e.message);
          });
    } catch (e) {
      if (logger) {
        logger.error(e);
      }
      respondWithError(req, res, e.message);
    }
  });

  router.post('/cancel', function(req, res, next) {
    respondWithError(req, res, 'User rejects integration');
  });

  router.post('/api/tariff_plan', function(req, res, next) {
    const {auth_metadata} = req.body;
    if (!auth_metadata || !auth_metadata.data) {
      if (logger) {
        logger.error(`Invalid auth_metadata ${JSON.stringify(auth_metadata)}`);
      }
      res.status(422);
      res.send({object: 'error', type: 'api_error', message: 'Invalid credentials'});
      return;
    }
    const {data: credentials, reference_id} = auth_metadata;
    try {
      providerHooks.authorise(credentials)
          .then(({error, ...reference}) => {
            if (error) {
              throw new Error(error);
            }
            return providerHooks.capture({
              ...reference, ...(reference_id && {reference_id}),
            });
          })
          .then(({tariff, error}) => {
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
            res.send({object: 'error', type: 'api_error', message: e.message});
          });
    } catch (e) {
      if (logger) {
        logger.error(e);
      }
      res.status(500);
      res.send({object: 'error', type: 'server_error', message: e.message});
    }
  });

  return router;
}

function errorHandler(err, req, res, next) {
  respondWithError(req, res, err.message);
}

export { errorHandler, integrateProvider, populateTemplate, respondWithError };
