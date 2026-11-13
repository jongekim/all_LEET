import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// 공개 디렉터리 밖의 빌드 산출물을 includeFiles로 함수에만 포함한다.
export default {
  async fetch(request: Request): Promise<Response> {
    const directory = resolve(process.cwd(), '.generated/community');
    const [renderer, template] = await Promise.all([
      import(pathToFileURL(resolve(directory, 'handler.mjs')).href) as Promise<{ handleCommunityRequest: (request: Request, template: string) => Promise<Response> }>,
      readFile(resolve(directory, 'template.html'), 'utf8'),
    ]);
    return renderer.handleCommunityRequest(request, template);
  },
};
