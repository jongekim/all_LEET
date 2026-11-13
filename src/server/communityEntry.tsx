import { renderPublicPage } from '../entry-prerender';
import { createCommunityHandler } from './communityHtml';

export function handleCommunityRequest(request: Request, template: string, fetcher: typeof fetch = fetch) {
  return createCommunityHandler(template, (url, community) => renderPublicPage(url, [], community), fetcher)(request);
}
