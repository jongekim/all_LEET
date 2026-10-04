import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

async function main() {
  const result=await build({entryPoints:['src/previews/DdayPreview.tsx'],bundle:true,minify:true,format:'iife',target:'es2020',write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const js=result.outputFiles[0].text.replace(/<\/script/gu,'<\\/script');
  await writeFile('docs/previews/dday-public.html',`<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>디데이 표시 미리보기</title><style>
    *{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:#172033;background:#f6f8fc}main{max-width:1120px;margin:auto;padding:24px}.notice{background:#fff2cc;padding:16px;border-radius:8px}h1{font-size:26px}h2{font-size:18px}h3{font-size:24px;margin-bottom:8px}.settings,.card{background:white;border:1px solid #dce3ee;border-radius:14px;padding:24px;margin:20px 0;min-width:0}.settings label{display:block;margin:12px 0}.settings input{display:block;width:100%;padding:10px;margin-top:8px;font:inherit;border:1px solid #becadb;border-radius:8px}button{padding:10px 16px;font:inherit;border-radius:8px;border:1px solid #2458bd;background:#2458bd;color:white;cursor:pointer}button:disabled{opacity:.5}.examples{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.dday{font-size:14px;font-weight:600;color:#dc2626;overflow-wrap:anywhere}.center{text-align:center}.caption{color:#56647a;font-size:14px;line-height:1.6}p{line-height:1.6}@media(max-width:720px){main{padding:16px}.examples{grid-template-columns:minmax(0,1fr)}}
    </style><div id="root"></div><script>${js}</script></html>`);
  console.log('분리 미리보기: docs/previews/dday-public.html');
}
void main().catch(cause=>{console.error(cause);process.exitCode=1;});
