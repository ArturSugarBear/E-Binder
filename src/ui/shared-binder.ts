import { z } from 'zod';
import { cloudClient } from '../data/supabase';
import { personalCardSchema } from '../domain/personal';
import type { WorkspaceContext } from './workspace-context';
import { action, el, message } from './workspace-dom';

const binderSchema = z.object({
  title: z.string(),
  grid_size: z.number().int(),
  page_titles: z.array(z.string()).min(1).max(200),
});
const cardsSchema = z.array(
  z.object({
    page_number: z.number().int().min(1),
    slot_index: z.number().int().min(0).max(11),
    slot_kind: z.enum(['owned', 'planned']),
    card_data: personalCardSchema,
  }),
);
export function renderSharedBinder(
  id: string,
  ctx: WorkspaceContext,
): HTMLElement {
  const root = el(
    'section',
    'w-shared-binder',
    el('h1', '', 'Geteilter Binder'),
    message('Binder wird geladen …'),
  );
  async function load(): Promise<void> {
    if (!cloudClient || !z.uuid().safeParse(id).success) {
      root.replaceChildren(
        el('h1', '', 'Binder nicht verfügbar'),
        message(
          'Dieser Link ist ungültig oder die Cloud ist nicht eingerichtet.',
        ),
      );
      return;
    }
    try {
      const [binderResult, cardsResult] = await Promise.all([
        cloudClient
          .from('binders')
          .select('title,grid_size,page_titles')
          .eq('id', id)
          .eq('is_public', true)
          .maybeSingle(),
        cloudClient
          .from('binder_cards')
          .select('page_number,slot_index,slot_kind,card_data')
          .eq('binder_id', id),
      ]);
      if (binderResult.error || cardsResult.error)
        throw new Error('Nicht erreichbar');
      if (!binderResult.data) {
        root.replaceChildren(
          el('h1', '', 'Binder nicht verfügbar'),
          message(
            'Der Binder ist privat, wurde entfernt oder der Link ist nicht mehr freigegeben.',
          ),
        );
        return;
      }
      const binder = binderSchema.parse(binderResult.data),
        cards = cardsSchema.parse(cardsResult.data);
      let page = 0;
      const content = el('div', 'w-shared-page');
      const draw = () => {
        const grid = el('div', 'w-pocket-grid');
        for (let slot = 0; slot < binder.grid_size; slot++) {
          const item = cards.find(
            (card) => card.page_number === page + 1 && card.slot_index === slot,
          );
          const pocket = el('div', 'w-pocket');
          if (item) {
            pocket.append(ctx.images.artwork(item.card_data));
            if (item.slot_kind === 'planned')
              pocket.append(el('span', 'w-badge', 'Geplant'));
          } else pocket.append(el('span', 'w-muted', 'Freier Platz'));
          grid.append(pocket);
        }
        const previous = action(
          'Vorherige Seite',
          () => {
            page--;
            draw();
          },
          'secondary',
        );
        previous.disabled = page === 0;
        const next = action(
          'Nächste Seite',
          () => {
            page++;
            draw();
          },
          'secondary',
        );
        next.disabled = page === binder.page_titles.length - 1;
        content.replaceChildren(
          el('h2', '', binder.page_titles[page]!),
          el(
            'p',
            'w-muted',
            `Seite ${page + 1} von ${binder.page_titles.length} · nur ansehen`,
          ),
          grid,
          el('div', 'w-action-row', previous, next),
        );
      };
      root.replaceChildren(el('h1', '', binder.title), content);
      draw();
    } catch {
      root.replaceChildren(
        el('h1', '', 'Binder konnte nicht geladen werden'),
        message('Prüfe deine Verbindung und versuche es erneut.'),
        action(
          'Erneut laden',
          () => {
            void load();
          },
          'secondary',
        ),
      );
    }
  }
  void load();
  return root;
}
