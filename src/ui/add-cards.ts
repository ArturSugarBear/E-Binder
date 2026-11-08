import {
  candidatesFromText,
  fetchRecognizedCards,
  recognitionClues,
  fetchCatalogCard,
  matchesCard,
  searchCatalog,
  type CatalogResult,
} from '../data/card-catalog';
import { recognizePhoto } from '../data/recognize';
import {
  changeState,
  confirmHolding,
  correctHolding,
  finishLabels,
  finishes,
  normalize,
  sameCard,
  uid,
  type Capture,
  type Finish,
  type PersonalCard,
} from '../domain/personal';
import {
  action,
  check,
  el,
  errorText,
  field,
  input,
  message,
  modal,
  select,
} from './workspace-dom';
import type { AddOptions, WorkspaceContext } from './workspace-context';

export function openAddCards(
  ctx: WorkspaceContext,
  options: AddOptions = {},
): void {
  const sheet = modal(
    options.correctHoldingId ? 'Ausgabe korrigieren' : 'Karten hinzufügen',
    true,
  );
  const notices = el('div', 'w-form-notices');
  notices.setAttribute('aria-live', 'polite');
  const results = el('div', 'w-search-results');
  const details = el('div', 'w-add-details');
  const queue = el('div', 'w-capture-queue');
  const photoArea = el('div', 'w-photo-review');
  const language = select(
    [
      ['de', 'Deutsch'],
      ['en', 'Englisch'],
    ],
    options.card?.language ?? 'de',
  );
  const search = input('search');
  search.placeholder = 'Kartenname oder Sammlernummer';
  search.autocomplete = 'off';
  const searchBox = field('Karte suchen', search);
  const searchLine = el(
    'div',
    'w-search-line',
    searchBox,
    field('Katalogsprache', language),
  );
  let selected = options.card;
  let captureId = options.captureId;
  let searchController: AbortController | undefined;
  let ocrController: AbortController | undefined;
  let debounce: ReturnType<typeof setTimeout>;
  let detailRequest = 0;
  let closed = false;
  let queueLimit = 30;
  sheet.onClose(() => {
    closed = true;
    searchController?.abort();
    ocrController?.abort();
    clearTimeout(debounce);
  });

  const gallery = input('file');
  gallery.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
  gallery.multiple = true;
  gallery.hidden = true;
  const camera = input('file');
  camera.accept = 'image/*';
  camera.setAttribute('capture', 'environment');
  camera.hidden = true;
  const upload = action(
    'Fotos auswählen',
    () => gallery.click(),
    'secondary',
    'upload',
  );
  const takePhoto = action(
    'Karte fotografieren',
    () => camera.click(),
    'secondary',
    'camera',
  );
  sheet.body.append(
    message(
      'Suche die genaue Ausgabe oder erfasse pro Foto eine Karte. Fotografiere die Karte aufrecht und möglichst bildfüllend, mit lesbarem Namen und Sammlernummer. Besitz entsteht erst nach deiner Bestätigung.',
    ),
    el(
      'div',
      'w-action-row',
      takePhoto,
      upload,
      action('Karte manuell eintragen', () => manualForm(), 'text'),
    ),
    gallery,
    camera,
    queue,
    searchLine,
    notices,
    photoArea,
    results,
    details,
  );
  sheet.footer.append(
    message(
      'Fotos und Texterkennung bleiben in diesem Browser. Beim ersten OCR-Start werden Programm- und Sprachdaten geladen.',
    ),
  );

  const capture = () =>
    ctx.state.captures.find((item) => item.id === captureId);
  const tell = (text: string, error = false) =>
    notices.replaceChildren(message(text, error ? 'error' : 'note'));
  const showCapture = () => {
    photoArea.replaceChildren();
    const shot = capture();
    if (!shot) return;
    const card: PersonalCard = selected
      ? { ...selected, photoId: shot.photoId }
      : {
          key: `photo:${shot.id}`,
          name: 'Dein Originalfoto',
          setName: 'Noch nicht zugeordnet',
          setId: '',
          number: 'offen',
          language: language.value,
          image: '',
          source: 'manual',
          sourceId: '',
          artist: '',
          artistSource: 'unknown',
          evolvesFrom: '',
          stage: '',
          finishes: ['normal'],
          photoId: shot.photoId,
        };
    const picture = ctx.images.artwork(card, 'w-original-photo');
    const copy = el(
      'div',
      '',
      el('h3', '', shot.name),
      el(
        'p',
        'w-muted',
        shot.status === 'confirmed'
          ? 'Dieses Foto wurde bereits übernommen.'
          : 'Vergleiche dein Foto mit der ausgewählten Ausgabe. Set, Nummer, Sprache und Variante müssen passen.',
      ),
    );
    if (shot.status !== 'confirmed')
      copy.append(
        action(
          'Text auf dem Foto erkennen',
          () => {
            void runOcr();
          },
          'secondary',
          'spark',
        ),
      );
    if (shot.error) copy.append(message(shot.error, 'error'));
    if (shot.text) {
      const disclosure = el(
        'details',
        'w-disclosure',
        el('summary', '', 'Erkannten Text ansehen'),
        el('pre', 'w-ocr-text', shot.text),
      );
      copy.append(disclosure);
    }
    photoArea.append(el('div', 'w-photo-comparison', picture, copy));
  };
  const showQueue = () => {
    queue.replaceChildren();
    const shots = ctx.state.captures;
    if (!shots.length) return;
    queue.append(
      el('p', 'w-eyebrow', 'Deine Erfassungssitzung'),
      el(
        'p',
        'w-muted',
        `${shots.filter((item) => item.status === 'pending').length} offen · ${shots.filter((item) => item.status === 'confirmed').length} übernommen`,
      ),
    );
    const list = el('div', 'w-capture-list');
    for (const shot of [...shots].reverse().slice(0, queueLimit)) {
      const button = action(
        `${shot.name} · ${shot.status === 'confirmed' ? 'übernommen' : shot.status === 'skipped' ? 'zurückgestellt' : 'offen'}`,
        () => {
          if (shot.status === 'confirmed' && shot.holdingId) {
            sheet.close();
            ctx.openHolding(shot.holdingId);
            return;
          }
          ocrController?.abort();
          captureId = shot.id;
          selected = undefined;
          details.replaceChildren();
          results.replaceChildren();
          notices.replaceChildren();
          showCapture();
          if (shot.candidates.length) renderChoices(shot.candidates);
        },
        'text',
      );
      button.setAttribute('aria-pressed', String(shot.id === captureId));
      list.append(button);
    }
    queue.append(list);
    if (shots.length > queueLimit)
      queue.append(
        action(
          'Weitere 30 Fotos anzeigen',
          () => {
            queueLimit += 30;
            showQueue();
          },
          'text',
        ),
      );
  };

  async function addFiles(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    upload.disabled = true;
    takePhoto.disabled = true;
    let first: string | undefined;
    let added = 0;
    let repeats = 0;
    try {
      for (const file of Array.from(files)) {
        if (
          file.size > 12000000 ||
          !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)
        )
          throw new Error(
            'Bitte nutze JPG, PNG, WebP oder HEIC/HEIF bis 12 MB pro Karte. Bereits aufgenommene Fotos bleiben erhalten.',
          );
        tell(`${file.name} wird lokal gesichert …`);
        const digest = await crypto.subtle.digest(
          'SHA-256',
          await file.arrayBuffer(),
        );
        const hash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
        const existing = ctx.state.captures.find((item) => item.hash === hash);
        if (existing) {
          first ??= existing.id;
          repeats++;
          continue;
        }
        const photoId = `photo-${hash}`;
        await ctx.store.putPhoto(ctx.state.mode, photoId, file);
        const shot: Capture = {
          id: uid(),
          photoId,
          hash,
          name: file.name.slice(0, 200),
          createdAt: new Date().toISOString(),
          status: 'pending',
          text: '',
          error: '',
          candidates: [],
        };
        if (
          !ctx.commit('Foto zur Erfassung hinzugefügt', (state) =>
            changeState(state, (next) => {
              next.captures.push(shot);
            }),
          )
        )
          break;
        first ??= shot.id;
        added++;
      }
      if (!closed) {
        captureId = first;
        selected = undefined;
        details.replaceChildren();
        results.replaceChildren();
        showQueue();
        showCapture();
        tell(
          `${added} neue Fotos gesichert.${repeats ? ` ${repeats} identische Fotos waren bereits erfasst; Mengen wurden nicht erhöht.` : ''} Wähle die Ausgabe für jedes offene Foto.`,
        );
      }
    } catch (error) {
      if (!closed) tell(errorText(error), true);
    } finally {
      upload.disabled = false;
      takePhoto.disabled = false;
      gallery.value = '';
      camera.value = '';
    }
  }
  gallery.addEventListener('change', () => {
    void addFiles(gallery.files);
  });
  camera.addEventListener('change', () => {
    void addFiles(camera.files);
  });

  async function runOcr(): Promise<void> {
    const shot = capture();
    if (!shot || shot.status === 'confirmed') return;
    ocrController?.abort();
    const controller = new AbortController();
    ocrController = controller;
    const status = el('p', 'w-muted', 'Texterkennung startet …');
    status.setAttribute('role', 'status');
    const progress = el('progress', 'w-progress');
    progress.max = 1;
    const stop = action(
      'Erkennung abbrechen',
      () => controller.abort(),
      'text',
    );
    notices.replaceChildren(status, progress, stop);
    try {
      const photo = await ctx.store.photo(ctx.state.mode, shot.photoId);
      if (!photo)
        throw new Error(
          'Das Originalfoto wurde im lokalen Speicher nicht gefunden.',
        );
      const text = await recognizePhoto(
        photo,
        controller.signal,
        (label, fraction) => {
          if (!closed && ocrController === controller) {
            status.textContent = label;
            if (fraction !== undefined) progress.value = fraction;
          }
        },
      );
      if (controller.signal.aborted || closed || ocrController !== controller)
        return;
      const known = [
        ...ctx.catalog,
        ...ctx.state.holdings.map((item) => item.card),
      ];
      const local = candidatesFromText(text, known);
      let online: PersonalCard[] = [];
      let catalogUnavailable = false;
      try {
        online = await fetchRecognizedCards(
          text,
          language.value,
          controller.signal,
        );
      } catch {
        catalogUnavailable = true;
      }
      if (controller.signal.aborted || closed) return;
      const candidates = [
        ...new Map(
          [...online, ...local].map((card) => [card.key, card]),
        ).values(),
      ].slice(0, 12);
      ctx.commit('Texterkennung abgeschlossen', (state) =>
        changeState(state, (next) => {
          const target = next.captures.find((item) => item.id === shot.id);
          if (target?.status === 'pending') {
            target.text = text.slice(0, 30000);
            target.candidates = candidates;
            target.error = '';
          }
        }),
      );
      showCapture();
      renderChoices(candidates);
      tell(
        candidates.length
          ? `Erkennungsvorschläge, noch kein bestätigter Bestand. Vergleiche Set, Sammlernummer und Sprache mit deinem Foto.${catalogUnavailable ? ' Der Online-Abgleich war nicht erreichbar; diese Vorschläge stammen aus dem lokalen Katalog.' : ''}`
          : 'Keine eindeutige Karte gefunden. Das Foto bleibt erhalten. Suche nach Name oder Nummer oder trage die Ausgabe manuell ein.',
      );
      const number = recognitionClues(text)[0]?.number;
      if (number && !candidates.length) {
        search.value = number;
      }
    } catch (error) {
      if (closed || ocrController !== controller) return;
      if (controller.signal.aborted) {
        tell('Erkennung abgebrochen. Das Foto bleibt in deiner Sitzung.');
        return;
      }
      const text = errorText(error);
      ctx.commit('Foto bleibt zur Klärung offen', (state) =>
        changeState(state, (next) => {
          const target = next.captures.find((item) => item.id === shot.id);
          if (target) target.error = text;
        }),
      );
      tell(text, true);
    }
  }

  function renderChoices(cards: PersonalCard[]): void {
    results.replaceChildren();
    const unique = [
      ...new Map(cards.map((card) => [card.key, card])).values(),
    ].slice(0, 24);
    for (const card of unique) {
      const button = action(card.name, () => choose(card), 'card');
      button.replaceChildren(
        ctx.images.artwork(card),
        el(
          'span',
          'w-card-caption',
          el('strong', '', card.name),
          el('small', '', `${card.setName} · ${card.number}`),
        ),
      );
      results.append(button);
    }
  }
  function choose(card: PersonalCard): void {
    selected = card;
    details.replaceChildren();
    notices.replaceChildren();
    renderConfirmation();
  }
  function renderConfirmation(): void {
    if (!selected) return;
    const card = selected;
    const original = options.correctHoldingId
      ? ctx.state.holdings.find((item) => item.id === options.correctHoldingId)
      : undefined;
    const shot = capture();
    const known = ctx.state.holdings.find((item) => sameCard(item.card, card));
    const finish = select(
      [
        ['', 'Variante auswählen'],
        ...finishes.map((key) => [key, finishLabels[key]] as [string, string]),
      ],
      original?.finish ?? (card.finishes.length === 1 ? card.finishes[0]! : ''),
    );
    const variant = input('text', original?.variantNote ?? '');
    variant.placeholder = 'z. B. 1. Auflage, Stempel';
    variant.maxLength = 200;
    const quantity = input(
      'number',
      String(original?.quantity ?? known?.quantity ?? 1),
    );
    quantity.min = '1';
    quantity.max = '999';
    quantity.required = true;
    const confirm = check(
      'Ausgabe, Sprache, Druckvariante und Gesamtmenge sind geprüft.',
    );
    const detailsLanguage = select(
      [
        ['de', 'Deutsch'],
        ['en', 'Englisch'],
        ['ja', 'Japanisch'],
        ['fr', 'Französisch'],
        ['it', 'Italienisch'],
        ['es', 'Spanisch'],
      ],
      card.language,
    );
    detailsLanguage.disabled = card.source !== 'manual';
    const form = el('form', 'w-confirm-form');
    const note = message(
      known
        ? `Diese Ausgabe ist bereits vorhanden. Du bestätigst den Gesamtbestand, keine automatisch zusätzlich gezählte Kopie.`
        : 'Trage nur physisch vorhandene Exemplare ein.',
    );
    const artist = card.artist
      ? `Illustration: ${card.artist}${card.artistSource === 'publisher' ? ' · Publisher-Credit geprüft' : card.artistSource === 'manual' ? ' · auf der Karte abgelesen' : ' · Katalogangabe'}`
      : 'Illustrator noch unbekannt';
    const error = message('', 'error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    const submit = action(
      original ? 'Korrektur übernehmen' : 'Bestand bestätigen',
      () => undefined,
      'primary',
      'check',
    );
    submit.type = 'submit';
    form.append(
      el(
        'div',
        'w-confirm-card',
        ctx.images.artwork(card),
        el(
          'div',
          '',
          el('p', 'w-eyebrow', 'Genaue Ausgabe prüfen'),
          el('h3', '', card.name),
          el('p', '', `${card.setName} · ${card.number}`),
          el('p', 'w-muted', artist),
        ),
      ),
      note,
      el(
        'div',
        'w-form-grid',
        field('Sprache der Karte', detailsLanguage),
        field('Druckvariante', finish),
        field('Variante / Auflage / Stempel', variant),
        field('Gesamtmenge dieser Variante', quantity),
      ),
      confirm.row,
      error,
      el(
        'div',
        'w-action-row',
        submit,
        action(
          'Auf die Wunschliste',
          () => {
            if (!ctx.state.wishes.some((wish) => sameCard(wish.card, card))) {
              ctx.commit('Wunschkarte hinzugefügt', (state) =>
                changeState(state, (next) => {
                  next.wishes.push({
                    id: uid(),
                    card,
                    quantity: 1,
                    priority: 'normal',
                    notes: '',
                  });
                }),
              );
              tell(
                'Wunschkarte gespeichert. Dein Besitz wurde nicht verändert.',
              );
            }
          },
          'secondary',
          'star',
        ),
      ),
    );
    finish.addEventListener('change', () => {
      const existing = ctx.state.holdings.find(
        (item) =>
          sameCard(item.card, card) &&
          item.finish === finish.value &&
          normalize(item.variantNote) === normalize(variant.value),
      );
      quantity.value = String(existing?.quantity ?? original?.quantity ?? 1);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      error.hidden = true;
      if (!confirm.input.checked || !finish.value) {
        error.textContent =
          'Bestätige die Ausgabe und wähle die Druckvariante.';
        error.hidden = false;
        return;
      }
      const adopted: PersonalCard = {
        ...card,
        language: detailsLanguage.value,
        ...(card.source === 'manual'
          ? {
              key: `manual:${normalize(card.setName)}:${normalize(card.number)}:${detailsLanguage.value}`,
            }
          : {}),
        ...(shot ? { photoId: shot.photoId } : {}),
      };
      const previous =
        original ??
        ctx.state.holdings.find(
          (item) =>
            sameCard(item.card, adopted) &&
            item.finish === finish.value &&
            normalize(item.variantNote) === normalize(variant.value),
        );
      const ok = ctx.commit(
        original ? 'Ausgabe korrigiert' : 'Bestand bestätigt',
        (state) =>
          original
            ? correctHolding(
                state,
                original.id,
                {
                  card: adopted,
                  finish: finish.value as Finish,
                  variantNote: variant.value,
                  quantity: Number(quantity.value),
                },
                captureId,
              )
            : confirmHolding(
                state,
                {
                  card: adopted,
                  finish: finish.value as Finish,
                  variantNote: variant.value,
                  quantity: Number(quantity.value),
                  tradeQuantity: previous?.tradeQuantity ?? 0,
                  favorite: previous?.favorite ?? false,
                  notes: previous?.notes ?? '',
                },
                captureId,
              ),
      );
      if (ok) {
        if (shot) {
          ocrController?.abort();
          ocrController = undefined;
          captureId = undefined;
          selected = undefined;
          details.replaceChildren();
          photoArea.replaceChildren();
          showQueue();
          tell('Foto übernommen. Prüfe jetzt das nächste offene Foto.');
        } else sheet.close();
      }
    });
    details.replaceChildren(form);
    showCapture();
    if (!shot) details.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }

  function manualForm(): void {
    selected = undefined;
    results.replaceChildren();
    details.replaceChildren();
    const name = input();
    name.required = true;
    const set = input();
    set.required = true;
    const number = input();
    number.required = true;
    number.placeholder = 'z. B. 211/198';
    const artist = input();
    const confirmedArtist = check(
      'Ich habe den Illustrator-Credit auf der Karte abgelesen.',
    );
    const form = el(
      'form',
      'w-manual-form',
      el('h3', '', 'Ausgabe manuell erfassen'),
      message(
        'Unbekannte Angaben bleiben offen. Ein Illustrator wird nur mit deiner Bestätigung für Artist-Vorschläge verwendet.',
      ),
      el(
        'div',
        'w-form-grid',
        field('Kartenname', name),
        field('Set', set),
        field('Sammlernummer', number),
        field('Illustrator (optional)', artist),
      ),
      confirmedArtist.row,
    );
    const next = action('Angaben und Menge prüfen', () => undefined, 'primary');
    next.type = 'submit';
    form.append(next);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const manual: PersonalCard = {
        key: `manual:${normalize(set.value)}:${normalize(number.value)}:${language.value}`,
        name: name.value.trim(),
        setName: set.value.trim(),
        setId: '',
        number: number.value.trim(),
        language: language.value,
        image: '',
        source: 'manual',
        sourceId: '',
        artist: confirmedArtist.input.checked ? artist.value.trim() : '',
        artistSource:
          confirmedArtist.input.checked && artist.value.trim()
            ? 'manual'
            : 'unknown',
        evolvesFrom: '',
        stage: '',
        finishes: [...finishes],
      };
      choose(manual);
    });
    details.append(form);
    name.focus();
  }

  async function onlineSearch(): Promise<void> {
    const value = search.value.trim();
    if (value.length < 2) {
      renderChoices(ctx.catalog.slice(0, 12));
      return;
    }
    searchController?.abort();
    const controller = new AbortController();
    searchController = controller;
    tell('Gesamter Kartenkatalog wird durchsucht …');
    try {
      const found = await searchCatalog(
        value,
        language.value,
        controller.signal,
      );
      if (closed || controller.signal.aborted) return;
      results.replaceChildren();
      for (const result of found) {
        const card: PersonalCard = {
          key: `tcgdex:${result.language}:${result.id}`,
          name: result.name,
          setName: result.id.split('-')[0]!,
          setId: '',
          number: result.localId,
          language: result.language,
          image: result.image ? `${result.image}/high.webp` : '',
          source: 'tcgdex',
          sourceId: result.id,
          artist: '',
          artistSource: 'unknown',
          evolvesFrom: '',
          stage: '',
          finishes: ['normal', 'holo', 'reverse', 'other'],
        };
        const button = action(
          result.name,
          () => {
            void loadResult(result);
          },
          'card',
        );
        button.replaceChildren(
          ctx.images.artwork(card),
          el(
            'span',
            'w-card-caption',
            el('strong', '', card.name),
            el('small', '', result.id),
          ),
        );
        results.append(button);
      }
      tell(
        found.length
          ? `${found.length} Ausgaben. Öffne eine Karte für die vollständigen Angaben.`
          : 'Keine passende Ausgabe gefunden. Versuche den Namen, die Nummer oder die manuelle Erfassung.',
      );
    } catch (error) {
      if (!controller.signal.aborted && !closed) tell(errorText(error), true);
    }
  }
  async function loadResult(result: CatalogResult): Promise<void> {
    const request = ++detailRequest;
    tell('Genaue Ausgabe wird geladen …');
    try {
      const card = await fetchCatalogCard(result.id, result.language);
      if (!closed && request === detailRequest) choose(card);
    } catch (error) {
      if (!closed) tell(errorText(error), true);
    }
  }
  search.addEventListener('input', () => {
    searchController?.abort();
    clearTimeout(debounce);
    renderChoices(
      ctx.catalog
        .filter((card) => matchesCard(card, search.value))
        .slice(0, 18),
    );
    if (search.value.trim().length >= 2)
      debounce = setTimeout(() => {
        void onlineSearch();
      }, 650);
  });
  language.addEventListener('change', () => {
    void onlineSearch();
  });
  showQueue();
  showCapture();
  if (selected) renderConfirmation();
  else if (capture()?.candidates.length) renderChoices(capture()!.candidates);
  else renderChoices(ctx.catalog.slice(0, 12));
  if (options.photos) gallery.click();
  else search.focus();
}
