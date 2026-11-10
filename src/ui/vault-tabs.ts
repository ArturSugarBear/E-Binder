import { el } from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';

export type VaultRoute = 'binder' | 'sammlung' | 'portfolio';

export function vaultTabs(
  ctx: WorkspaceContext,
  active: VaultRoute,
): HTMLElement {
  const navigation = el('nav', 'w-vault-tabs w-glass-panel');
  navigation.setAttribute('aria-label', 'Sammlungsansichten');
  const tabs: [VaultRoute, string][] = [
    ['binder', 'Binder'],
    ['sammlung', 'Karten'],
    ['portfolio', 'Portfolio'],
  ];
  for (const [route, caption] of tabs) {
    const link = el('a', 'w-vault-tab', caption);
    link.href = `#${route}`;
    link.setAttribute('aria-current', active === route ? 'page' : 'false');
    link.addEventListener('click', (event) => {
      event.preventDefault();
      ctx.navigate(route);
    });
    navigation.append(link);
  }
  return navigation;
}
