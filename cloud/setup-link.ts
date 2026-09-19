/** Consume only the URL fragment; the bootstrap secret never enters a query. */
export function consumeSetupLink(location:Pick<Location,'href'>, history:Pick<History,'state'|'replaceState'>):string {
  const url = new URL(location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (!fragment.has('setup')) return '';
  const token = fragment.get('setup') || '';
  fragment.delete('setup');
  url.hash = fragment.toString();
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return token.length <= 512 ? token : '';
}
