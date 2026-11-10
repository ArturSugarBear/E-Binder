import {
  candidatesFromText,
  fetchRecognizedCards,
  fetchNameHintCandidates,
  recognitionClues,
  matchesCard,
} from '../data/card-catalog';
import { recognizePhoto } from '../data/recognize';
import { alignPhoto } from './photo-crop';
import { createCatalogBrowser } from './catalog-browser';
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
  choices,
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
  const transientPhotos = new Map<string, Blob>();
  const previewUrls = new Set<string>();
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
  const language = choices(
    'Katalogsprache',
    [
      ['de', 'Deutsch'],
      ['en', 'Englisch'],
      ['ja', 'Japanisch'],
    ],
    options.language ?? options.card?.language ?? 'de',
  );
  const search = input('search');
  search.placeholder = 'Kartenname oder Sammlernummer';
  search.autocomplete = 'off';
  const searchBox = field('Karte suchen', search);
  const searchLine = el('div', 'w-search-line', searchBox, language.element);
  const browser = createCatalogBrowser({
    ctx,
    search,
    language,
    results,
    artist: options.artist,
    browse: options.browse,
    setId: options.setId,
    onChoose: (card) => choose(card),
    onSearch: (reset) => {
      void onlineSearch(reset);
    },
    tell: (text, error = false) =>
      notices.replaceChildren(message(text, error ? 'error' : 'note')),
  });
  let selected = options.card;
  let captureId = options.captureId;
  let searchController: AbortController | undefined;
  let ocrController: AbortController | undefined;
  let debounce: ReturnType<typeof setTimeout>;
  let closed = false;
  let queueLimit = 30;
  const interrupt = () => {
    ocrController?.abort();
    ocrController = undefined;
    searchController?.abort();
    clearTimeout(debounce);
  };
  sheet.onClose(() => {
    closed = true;
    transientPhotos.clear();
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls.clear();
    browser.close();
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
  const scanBinder = action(
    'Ganze Binderseite scannen',
    () => {
      sheet.close();
      ctx.openPageScan();
    },
    'primary',
    'binder',
  );
  const captureStart = el(
    'section',
    'w-capture-start',
    el('h3', '', 'Wie möchtest du Karten erfassen?'),
    el(
      'div',
      'w-capture-start-grid',
      scanBinder,
      takePhoto,
      upload,
    ),
    action('Karte manuell eintragen', () => manualForm(), 'text'),
  );
  captureStart.hidden = Boolean(options.correctHoldingId);
  const advancedCatalog = el(
    'details',
    'w-add-catalog-advanced',
    el('summary', '', 'Erweiterte Suche: Set, Illustrator und Seltenheit'),
    browser.element,
  );
  advancedCatalog.open = Boolean(options.browse || options.setId || options.artist);
  sheet.body.append(
    captureStart,
    el(
      'p',
      'w-muted w-add-capture-intro',
      'Ein Foto für eine Einzelkarte oder ein Foto für eine ganze Binderseite. Keine Beispielkarten werden automatisch als deine Karten vorgeschlagen.',
    ),
    gallery,
    camera,
    queue,
    searchLine,
    advancedCatalog,
    notices,
    photoArea,
    results,
    browser.pager,
    details,
  );
  sheet.footer.append(
    message(
      ctx.account && ctx.state.mode !== 'demo'
        ? 'Texterkennung läuft im Browser. Fotos werden anschließend verworfen. Dein Konto speichert ausschließlich Karten-Metadaten; Katalogbilder kommen direkt von TCGdex.'
        : 'Fotos werden nur vorübergehend für die Erkennung geöffnet und beim Schließen verworfen. Gespeichert werden Karten-Metadaten. Katalogbilder kommen von TCGdex.',
    ),
  );

  const capture = () =>
    ctx.state.captures.find((item) => item.id === captureId);
  const tell = (text: string, error = false) =>
    notices.replaceChildren(message(text, error ? 'error' : 'note'));
  const showCapture = () => {
    photoArea.replaceChildren();
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls.clear();
    const shot = capture();
    if (!shot) return;
    const temporary = transientPhotos.get(shot.id);
    const picture = el('span', 'card-art w-original-photo');
    if (temporary) {
      const url = URL.createObjectURL(temporary);
      previewUrls.add(url);
      const image = el('img');
      image.src = url;
      image.alt = 'Temporäre Aufnahme für die Erkennung';
      picture.append(image);
    } else picture.append(el('span', 'art-fallback', 'Kein Foto gespeichert'));
    const copy = el(
      'div',
      '',
      el('h3', '', shot.name),
      el(
        'p',
        'w-muted',
        shot.status === 'confirmed'
          ? 'Dieses Foto wurde bereits übernommen.'
          : temporary
            ? shot.text && !shot.candidates.length
              ? 'Kein verlässlicher Treffer. Richte die Ecken auf die gedruckte Karte aus und prüfe die vergrößerte Sammlernummer. Das Foto bleibt nur bis zum Schließen geöffnet.'
              : 'Vergleiche die Aufnahme mit der Ausgabe. Das Foto wird beim Schließen verworfen.'
            : 'Nur das Erkennungsergebnis wurde gespeichert. Prüfe die Ausgabe oder fotografiere die Karte erneut.',
      ),
    );
    if (shot.status !== 'confirmed' && temporary)
      copy.append(
        action(
          'Foto ausrichten und erkennen',
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
          interrupt();
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

  async function addFiles(
    files: FileList | null,
    fromCamera = false,
  ): Promise<void> {
    if (!files?.length) return;
    interrupt();
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
            'Bitte nutze JPG, PNG, WebP oder HEIC/HEIF bis 12 MB pro Karte. Bereits geöffnete Aufnahmen bleiben bis zum Schließen im Arbeitsspeicher.',
          );
        tell(`${file.name} wird für die Erkennung geöffnet …`);
        const digest = await crypto.subtle.digest(
          'SHA-256',
          await file.arrayBuffer(),
        );
        const hash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
        const existing = ctx.state.captures.find((item) => item.hash === hash);
        if (existing) {
          transientPhotos.set(existing.id, file);
          first ??= existing.id;
          repeats++;
          continue;
        }
        const shot: Capture = {
          id: uid(),
          hash,
          name: file.name.slice(0, 200),
          createdAt: new Date().toISOString(),
          status: 'pending',
          text: '',
          error: '',
          candidates: [],
        };
        transientPhotos.set(shot.id, file);
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
        photoArea.scrollIntoView({ block: 'start' });
        tell(
          `${added} Aufnahmen geöffnet.${repeats ? ` ${repeats} identische Fotos waren bereits erfasst; Mengen wurden nicht erhöht.` : ''} Richte das Foto aus und starte die Erkennung oder suche die Ausgabe manuell.`,
        );
      }
    } catch (error) {
      if (!closed) {
        if (first) {
          captureId = first;
          selected = undefined;
          details.replaceChildren();
          results.replaceChildren();
          showQueue();
          showCapture();
        }
        tell(errorText(error), true);
      }
    } finally {
      upload.disabled = false;
      takePhoto.disabled = false;
      gallery.value = '';
      camera.value = '';
    }
    if (fromCamera && first && !closed) await runOcr();
  }
  gallery.addEventListener('change', () => {
    void addFiles(gallery.files);
  });
  camera.addEventListener('change', () => {
    void addFiles(camera.files, true);
  });

  async function runOcr(): Promise<void> {
    const shot = capture();
    if (!shot || shot.status === 'confirmed') return;
    interrupt();
    const controller = new AbortController();
    ocrController = controller;
    selected = undefined;
    details.replaceChildren();
    results.replaceChildren();
    const status = el('p', 'w-muted', 'Texterkennung startet …');
    status.setAttribute('role', 'status');
    const progress = el('progress', 'w-progress');
    progress.max = 1;
    progress.setAttribute('aria-label', 'Fortschritt der Kartenerkennung');
    const stop = action(
      'Erkennung abbrechen',
      () => controller.abort(),
      'text',
    );
    notices.replaceChildren(status, progress, stop);
    try {
      const photo = transientPhotos.get(shot.id);
      if (!photo)
        throw new Error(
          'Die Aufnahme ist nicht mehr geöffnet. Fotografiere die Karte erneut; Bilder werden nicht gespeichert.',
        );
      const aligned = await alignPhoto(photo, controller.signal);
      if (!aligned || closed || controller.signal.aborted) {
        if (!closed && ocrController === controller)
          tell(
            'Ausrichtung abgebrochen. Die Aufnahme bleibt bis zum Schließen geöffnet.',
          );
        return;
      }
      const text = await recognizePhoto(
        aligned,
        controller.signal,
        (label, fraction) => {
          if (!closed && ocrController === controller) {
            status.textContent = label;
            if (fraction !== undefined) progress.value = fraction;
            else progress.removeAttribute('value');
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
      status.textContent = 'Kartenausgaben werden im Katalog abgeglichen …';
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
      if (controller.signal.aborted || closed || ocrController !== controller)
        return;
      let titleHint = '';
      if (!online.length && navigator.onLine && text.trim()) {
        try {
          const found = await fetchNameHintCandidates(
            text,
            language.value,
            controller.signal,
          );
          online = found.candidates;
          titleHint = found.query;
        } catch {
          // No invented edition if an optional name lookup fails.
        }
      }
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
      if (candidates.length) results.scrollIntoView({ block: 'start' });
      else {
        photoArea.scrollIntoView({ block: 'start' });
        photoArea
          .querySelector<HTMLButtonElement>('button')
          ?.focus({ preventScroll: true });
      }
      tell(
        candidates.length
          ? `${titleHint ? `Kartenname „${titleHint}“ gelesen. ` : ''}Mögliche Ausgaben, noch kein bestätigter Bestand. Vergleiche Set, Sammlernummer und Sprache mit deinem Foto.${catalogUnavailable ? ' Der Nummernabgleich war nicht erreichbar.' : ''}`
          : 'Kein eindeutiger Kartentreffer. Prüfe die Aufnahme oder suche gezielt nach Name und Nummer. Es wurde nichts in den Bestand übernommen.',
      );
      const number = recognitionClues(text)[0]?.number;
      if (number && !candidates.length) {
        search.value = number;
        void onlineSearch();
      }
    } catch (error) {
      if (closed || ocrController !== controller) return;
      if (controller.signal.aborted) {
        tell(
          'Erkennung abgebrochen. Die Aufnahme bleibt bis zum Schließen geöffnet.',
        );
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
    results.classList.remove('w-text-results');
    browser.pager.replaceChildren();
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
    interrupt();
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
      if (!finish.value) {
        error.textContent = 'Wähle die Druckvariante dieser Karte.';
        error.hidden = false;
        finish.focus();
        return;
      }
      if (!confirm.input.checked) {
        error.textContent =
          'Die Druckvariante ist ausgewählt. Bestätige noch das Kontrollkästchen für Ausgabe, Sprache und Gesamtmenge.';
        error.hidden = false;
        confirm.input.focus();
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
      };
      delete adopted.photoId;
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
          transientPhotos.delete(shot.id);
          ocrController?.abort();
          ocrController = undefined;
          captureId = ctx.state.captures.find(
            (item) => item.status === 'pending',
          )?.id;
          selected = undefined;
          details.replaceChildren();
          results.replaceChildren();
          showQueue();
          showCapture();
          tell(
            captureId
              ? 'Foto übernommen. Das nächste offene Foto ist ausgewählt.'
              : 'Foto übernommen. Du kannst die nächste Karte fotografieren oder weitere Fotos auswählen.',
          );
        } else sheet.close();
      }
    });
    details.replaceChildren(form);
    showCapture();
    details.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  function manualForm(): void {
    interrupt();
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
        // 'unverified' is a holding state, not a fifth advertised printing.
        finishes: finishes.filter((printing) => printing !== 'unverified'),
      };
      choose(manual);
    });
    details.append(form);
    name.focus();
  }

  async function onlineSearch(reset = true): Promise<void> {
    const value = search.value.trim();
    if (value.length < 2 && !browser.hasFilters()) {
      results.replaceChildren();
      browser.pager.replaceChildren();
      return;
    }
    interrupt();
    const controller = new AbortController();
    searchController = controller;
    try {
      await browser.run(controller.signal, reset);
    } catch (error) {
      if (!controller.signal.aborted && !closed) tell(errorText(error), true);
    }
  }
  search.addEventListener('input', () => {
    interrupt();
    clearTimeout(debounce);
    if (search.value.trim().length >= 2) {
      renderChoices(
        ctx.catalog
          .filter((card) => matchesCard(card, search.value))
          .slice(0, 18),
      );
    } else {
      results.replaceChildren();
      browser.pager.replaceChildren();
    }
    if (search.value.trim().length >= 2 || browser.hasFilters())
      debounce = setTimeout(() => {
        void onlineSearch();
      }, 650);
  });
  language.addEventListener('change', () => {
    interrupt();
    browser.languageChanged();
  });
  showQueue();
  showCapture();
  if (selected) renderConfirmation();
  else if (capture()?.candidates.length) renderChoices(capture()!.candidates);
  else results.replaceChildren();
  if (options.photos) gallery.click();
  else search.focus();
}
