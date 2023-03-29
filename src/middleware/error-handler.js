import {respondWithError} from '../helpers/render';

export function errorHandler(err, req, res, next) {
  respondWithError(req, res, err.message);
}
