import { exportBackup, parseBackup, type Backup } from '../data/personal-store';
import {
  action,
  el,
  errorText,
  input,
  message,
  modal,
  saveFile,
} from './workspace-dom';
import type { WorkspaceContext } from './workspace-context';
import { uid, type PersonalCard } from '../domain/personal';

export function openBackup(ctx: WorkspaceContext): void {
  const sheet = modal('Sichern & wiederherstellen');
  const status = el('div', 'w-form-notices');
  status.setAttribute('aria-live', 'polite');
  const file = input('file');
  file.accept = '.jsonl,.ndjson,application/x-ndjson';
  file.hidden = true;
  const preview = el('div', 'w-import-preview');
  let backup: Backup | undefined;
  const exportButton = action(
    'Sicherung herunterladen',
    () => {
      void download();
    },
    'primary',
    'download',
  );
  const importButton = action(
    'Sicherung auswählen',
    () => file.click(),
    'secondary',
    'upload',
  );
  sheet.body.append(
    message(
      ctx.state.mode === 'demo'
        ? 'Du sicherst gerade den Beispielbestand. Er wird beim Wiederherstellen als Demo behandelt.'
        : 'Deine Sammlung liegt auf diesem Gerät. Sichere sie regelmäßig, besonders vor einem Gerätewechsel oder dem Löschen von Browserdaten.',
    ),
    el(
      'div',
      'w-backup-option',
      el('h3', '', 'Vollständige JSONL-Sicherung'),
      el(
        'p',
        'w-muted',
        'Enthält bestätigte Mengen, Binderplätze, Wünsche, offene Erfassungen und Originalfotos. Keine Weitergabe an einen Server.',
      ),
      exportButton,
    ),
    el(
      'div',
      'w-backup-option',
      el('h3', '', 'Eine Sicherung wiederherstellen'),
      el(
        'p',
        'w-muted',
        'Zuerst prüfen, dann den aktuellen Bestand ersetzen. Es werden keine Mengen automatisch addiert.',
      ),
      importButton,
      file,
    ),
    status,
    preview,
  );
  async function download(): Promise<void> {
    exportButton.disabled = true;
    status.replaceChildren(
      message('Sicherung wird mit den Originalfotos zusammengestellt …'),
    );
    try {
      const blob = await exportBackup(ctx.state, ctx.store);
      saveFile(
        blob,
        `e-binder-${ctx.state.mode}-${new Date().toISOString().slice(0, 10)}.jsonl`,
      );
      status.replaceChildren(
        message(
          'Die vollständige Sicherung wurde zum Download übergeben. Prüfe die Datei in deinen Downloads.',
        ),
      );
    } catch (error) {
      status.replaceChildren(message(errorText(error), 'error'));
    } finally {
      exportButton.disabled = false;
    }
  }
  file.addEventListener('change', () => {
    void inspect();
  });
  async function inspect(): Promise<void> {
    const selected = file.files?.[0];
    if (!selected) return;
    preview.replaceChildren();
    backup = undefined;
    try {
      if (selected.size > 256000000)
        throw new Error('Die Datei ist größer als 256 MB.');
      const parsed = parseBackup(await selected.text());
      if (parsed.state.mode !== ctx.state.mode)
        throw new Error(
          'Demo und persönlicher Bestand bleiben getrennt. Wechsle zuerst in den passenden Modus.',
        );
      backup = parsed;
      status.replaceChildren();
      const acknowledgement = input('checkbox');
      const counts = `${parsed.state.holdings.length} Ausgaben · ${parsed.state.binders.length} Binder · ${parsed.state.wishes.length} Wünsche · ${parsed.photos.size} Originalfotos`;
      preview.append(
        el('h3', '', 'Sicherung geprüft'),
        el('p', '', counts),
        el(
          'label',
          'w-check',
          acknowledgement,
          el(
            'span',
            '',
            'Ich möchte den aktuellen Bestand durch diese Sicherung ersetzen.',
          ),
        ),
      );
      const restore = action(
        'Geprüfte Sicherung wiederherstellen',
        () => {
          void apply(acknowledgement.checked);
        },
        'primary',
        'check',
      );
      preview.append(restore);
    } catch (error) {
      status.replaceChildren(message(errorText(error), 'error'));
    }
  }
  async function apply(acknowledged: boolean): Promise<void> {
    if (!backup || !acknowledged) {
      status.replaceChildren(
        message(
          'Bestätige zuerst das Ersetzen des aktuellen Bestands.',
          'error',
        ),
      );
      return;
    }
    importButton.disabled = true;
    try {
      const next = structuredClone(backup.state);
      // Keep previous originals intact so undo also restores the correct images.
      const ids = new Map(
        [...backup.photos.keys()].map((id) => [id, `photo-${uid()}`]),
      );
      const remap = (card: PersonalCard) => {
        if (card.photoId) card.photoId = ids.get(card.photoId)!;
      };
      next.holdings.forEach((holding) => remap(holding.card));
      next.wishes.forEach((wish) => remap(wish.card));
      next.captures.forEach((capture) => {
        capture.photoId = ids.get(capture.photoId)!;
        capture.candidates.forEach(remap);
      });
      next.binders.forEach((binder) =>
        binder.pages.forEach((page) =>
          page.slots.forEach((slot) => {
            if (slot?.kind === 'planned') remap(slot.card);
          }),
        ),
      );
      const photos = new Map(
        [...backup.photos].map(([id, blob]) => [ids.get(id)!, blob]),
      );
      const success = await ctx.restore(next, photos);
      if (success) {
        ctx.navigate('sammlung');
        sheet.close();
      }
    } catch (error) {
      status.replaceChildren(message(errorText(error), 'error'));
    } finally {
      importButton.disabled = false;
    }
  }
}
