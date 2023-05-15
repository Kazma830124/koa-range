import {Context} from 'koa';
import parseHttpDate from './parse-http-date';
import parseTokenList from './parse-token-list';

export default function isPreconditionFailure(ctx: Context) {
  const req = ctx.request;
  const res = ctx.response;

  // if-match
  const match = req.get('if-match');
  if (match) {
    const etag = res.get('ETag');

    return !etag || match !== '*' && parseTokenList(match).every(function (match) {
      return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag;
    });
  }

  // if-unmodified-since
  const unmodifiedSince = parseHttpDate(req.get('if-unmodified-since'));
  if (!isNaN(unmodifiedSince)) {
    const lastModified = parseHttpDate(res.get('Last-Modified'));

    return isNaN(lastModified) || lastModified > unmodifiedSince;
  }

  return false;
}
