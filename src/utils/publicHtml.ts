export function finishPublicHtml() {
  const root = document.getElementById('root');
  if (root) {
    root.hidden = false;
    root.setAttribute('data-app-ready', 'true');
  }
  document.getElementById('prerender-shell')?.remove();
}
