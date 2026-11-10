import { animate, stagger } from 'motion';
import 'simple-liquid-glass/web-component';

const prefersCalm = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;
const prefersOpaque = () =>
  matchMedia('(prefers-reduced-transparency: reduce)').matches;

/**
 * One refracting material on the floating navigation, not 80 glass panels.
 * The web component uses SVG lensing on Chromium and an explicit WebGL
 * backdrop source on iOS Safari. Blur remains a safe fallback.
 */
export function initCollectorMaterial(): void {
  const nav = document.querySelector<HTMLElement>('.w-mobile-nav');
  if (!nav || nav.querySelector('.w-liquid-optic') || prefersOpaque()) return;
  const optic = document.createElement('liquid-glass');
  optic.className = 'w-liquid-optic';
  optic.setAttribute('aria-hidden', 'true');
  optic.setAttribute('backdrop-selector', '#workspace-main');
  optic.setAttribute('lens-profile', 'material');
  optic.setAttribute('radius', '28');
  optic.setAttribute('strength', '0.12');
  optic.setAttribute('blur', '8');
  optic.setAttribute('frost', '0.14');
  optic.setAttribute('saturation', '135');
  nav.prepend(optic);
  // The library can deliberately fall back to blur when WebGL/SVG is
  // unavailable. Never remove the solid dock backdrop in that case.
  const refresh = () => {
    const strategy = optic.getAttribute('data-glass-strategy');
    nav.classList.toggle(
      'w-liquid-ready',
      strategy === 'webgl' || strategy === 'svg',
    );
  };
  const watcher = new MutationObserver(refresh);
  watcher.observe(optic, {
    attributes: true,
    attributeFilter: ['data-glass-strategy'],
  });
  customElements.whenDefined('liquid-glass').then(refresh).catch(refresh);
}

/** Navigation should feel spatial, not repaint dozens of unrelated tiles. */
export function revealCollectorRoute(root: HTMLElement): void {
  if (prefersCalm()) return;
  const pieces = root.querySelectorAll<HTMLElement>(
    '.w-home-hero, .w-home-quick, .w-discover-mode, .w-portfolio-hero, .w-portfolio-by-set, .w-vault-overview',
  );
  if (!pieces.length) return;
  animate(
    pieces,
    { opacity: [0.86, 1], y: [11, 0] },
    { duration: 0.36, ease: [0.22, 1, 0.36, 1], delay: stagger(0.035) },
  );
}

/** Trigger only after a real OCR/empty-pocket decision, never a fake result. */
export function animateResolvedPocket(
  pocket: HTMLElement | undefined,
  outcome: 'card' | 'empty' | 'unknown',
): void {
  if (!pocket) return;
  pocket.dataset.scanOutcome = outcome;
  if (prefersCalm()) return;
  animate(
    pocket,
    { scale: [0.975, 1.035, 1], opacity: [0.68, 1] },
    { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
  );
}

/** A chart bar springs only to an actually observed inventory value. */
export function revealPortfolioBars(scope: HTMLElement): void {
  if (prefersCalm()) return;
  const bars = scope.querySelectorAll<HTMLElement>('.w-portfolio-set-fill');
  bars.forEach((bar, index) => {
    const width = bar.style.width;
    if (!width) return;
    animate(
      bar,
      { width: ['0%', width] },
      { duration: 0.75, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] },
    );
  });
}

/** Motion, never hand-built easing, draws only measured historical points. */
export function revealHistoryStroke(path: SVGPathElement): void {
  if (prefersCalm()) return;
  animate(
    path,
    { pathLength: [0, 1] },
    { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  );
}
