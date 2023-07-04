import {Router} from 'express';
import {connectTariff} from '../helpers/connector';
import {captureAuthMetaData, captureInputParams, populateTemplate, respondWithError} from '../helpers/render';

/**
 * Returns a router with two routes /login and /callback
 *
 * @param {ConfigParams} [params] The parameters object; see index.d.ts for types and descriptions.
 *
 * @return {express.Router} the router
 */
export function integrateProvider(params) {
  const {pages, appParams, providerHooks} = params;
  const {logger} = providerHooks;
  const router = new Router();

  router.get('/', function(req, res, next) {
    const {
      'publishable-key': publishable_key,
      'product-id': product_id,
      'customer-id': customer_id,
      'callback-url': callback_url,
    } = req.headers;
    if (publishable_key) { // capture input params from headers
      return captureInputParams(req, res, appParams, providerHooks, {
        publishable_key, product_id, customer_id, callback_url,
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
    const {publishable_key: publishable_key, product_id, customer_id, callback_url} = req.body;
    captureInputParams(req, res, appParams, providerHooks, {publishable_key, product_id, customer_id, callback_url});
  });

  router.get('/auth', function(req, res, next) {
    if (!req.session || !req.session.account || !req.session.provider) {
      req.session.destroy();
      res.redirect('/');
      return;
    }

    res.render(pages.auth.view, {
      title: pages.auth.title,
      ...populateTemplate(req.session),
      ...(pages.auth.hasOwnProperty('params') && pages.auth.params),
    });
  });

  router.post('/auth', function(req, res, next) {
    if (!req.session || !req.session.account) {
      res.redirect('/');
      return;
    }
    captureAuthMetaData(req, res, providerHooks, req.body);
  });

  router.get('/share', function(req, res, next) {
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
      ...(pages.share.hasOwnProperty('params') && pages.share.params),
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

    const {auth_metadata: credentials, publishable_key: publishable_key, product_id, customer_id, callback_url} = req.session;

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
