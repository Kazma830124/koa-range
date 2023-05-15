import {IncomingHttpHeaders} from 'http';
import parseTokenList from './parse-token-list';
import parseHttpDate from './parse-http-date';

/* !
 * fresh
 * Copyright(c) 2012 TJ Holowaychuk
 * Copyright(c) 2016-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * RegExp to check for no-cache token in Cache-Control.
 * @private
 */

let CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

/**
 * Check freshness of the response using request and response headers.
 *
 * @param reqHeaders
 * @param resHeaders
 * @return
 * @public
 */

export default function fresh(reqHeaders: IncomingHttpHeaders, resHeaders: IncomingHttpHeaders) {
  // fields
  let modifiedSince = reqHeaders['if-modified-since'];
  let noneMatch = reqHeaders['if-none-match'];

  // unconditional request
  if (!modifiedSince && !noneMatch) {
    return false;
  }

  // Always return stale when Cache-Control: no-cache
  // to support end-to-end reload requests
  // https://tools.ietf.org/html/rfc2616#section-14.9.4
  let cacheControl = reqHeaders['cache-control'];
  if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
    return false;
  }

  // if-none-match
  if (noneMatch && noneMatch !== '*') {
    let etag = resHeaders['etag'];

    if (!etag) {
      return false;
    }

    let etagStale = true;
    let matches = parseTokenList(noneMatch);
    for (let i = 0; i < matches.length; i++) {
      let match = matches[i];
      if (match === etag || match === 'W/' + etag || 'W/' + match === etag) {
        etagStale = false;
        break;
      }
    }

    if (etagStale) {
      return false;
    }
  }

  // if-modified-since
  if (modifiedSince) {
    let lastModified = resHeaders['last-modified'];
    let modifiedStale = !lastModified || !(parseHttpDate(lastModified) <= parseHttpDate(modifiedSince));

    if (modifiedStale) {
      return false;
    }
  }

  return true;
}
