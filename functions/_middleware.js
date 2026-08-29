/**
 * Rewrite invite/promo HTML so apple-itunes-app already carries
 * app-argument, og:url / canonical / twitter:url already name the
 * landing URL, og:title / twitter:title / og:description already name
 * the campaign code, ?lang=en already sets html lang / og:locale, and
 * Facebook App Links are present. Safari and share
 * crawlers snapshot those from the HTML bytes before
 * /js/invite-banner.js and invite.js run.
 * public/ stays generic; this is not a site-wide renderer.
 */
import { injectLandingFromRequestUrl, shouldRewriteItunesBanner } from './lib/itunes-banner.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!shouldRewriteItunesBanner(url.pathname)) {
    return context.next();
  }
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (context.request.method !== 'GET' || !type.includes('text/html')) {
    return response;
  }
  const html = await response.text();
  const injected = injectLandingFromRequestUrl(html, context.request.url);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
