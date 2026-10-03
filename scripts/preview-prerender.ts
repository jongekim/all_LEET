import { readFileSync } from 'node:fs';
import { preview } from 'vite';
import type { Rewrite } from './prerenderRoutes';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const rules: Rewrite[] = config.rewrites.filter((rule: Rewrite) => rule.destination.startsWith('/prerender/'));
void preview({
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, open: false },
  plugins: [{
    name: 'preview-public-html',
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1:4173');
        const path = url.pathname.replace(/\/$/, '') || '/';
        const rule = rules.find(candidate => candidate.source === path
          && (candidate.has ?? []).every(condition => url.searchParams.get(condition.key) === condition.value)
          && (candidate.missing ?? []).every(condition => url.searchParams.get(condition.key) !== condition.value));
        if (rule) request.url = rule.destination;
        else if (path !== '/' && !path.includes('.')) request.url = '/app.html';
        next();
      });
    },
  }],
}).then(server => server.printUrls()).catch(error => { console.error(error); process.exitCode = 1; });
