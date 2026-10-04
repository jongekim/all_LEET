import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
async function main(){
await build({entryPoints:['src/previews/AdminDashboardPreview.tsx'],bundle:true,minify:true,format:'esm',target:'es2020',outfile:'docs/previews/admin-dashboard-development.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
await writeFile('docs/previews/admin-dashboard-development.html','<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>관리자 대시보드 개발 미리보기</title><link rel="stylesheet" href="admin-dashboard-development.css"><style>body{margin:0;background:#f8fafc}*{box-sizing:border-box}</style><div id="root"></div><script type="module" src="admin-dashboard-development.js"></script></html>');
console.log('분리된 예시 미리보기: docs/previews/admin-dashboard-development.html');

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
