# E-Binder — Ultra-Critical Apple UI Review

**Date:** 13 November 2026  
**Scope:** Current `master` UI, product and design docs, committed 320/390 screenshots  
**Type:** Design and interaction review. No production code was changed for this review.  
**Stance:** Senior Apple platform UI / iOS interaction review.

> This review is intentionally critical. It does not propose a new brand, a framework migration, or a redesign of the data model. It preserves Rare Room V2, the privacy-first architecture, and the native TypeScript/DOM stack.

## Review basis and limits

- Read: `AGENTS.md`, `PRODUCT.md`, `docs/design.md`, `docs/research/ui-usability.md`, `index.html`, the `src/ui` and CSS implementation, the Playwright configuration, and the committed screenshots.
- Not executed in this session: `npm run check`, the Playwright suite, a physical iPhone camera session, VoiceOver, Dynamic Type, and a real-device performance trace.
- Some committed screenshots predate the current five-tab dock. Where screenshots and code differ, the current code is authoritative.
- No user study, recognition accuracy, or physical setup is claimed.

## 1. Verdict

E-Binder has a product soul and an ethical spine that most Apple-grade apps would envy: it refuses to invent possession, refuses to invent prices, confirms before committing, and labels uncertainty honestly. But the interface is still a beautifully art-directed web app wearing an Apple costume. It looks like Apple from three meters away and behaves like a website from thirty centimeters.

The gap is not the logo or the lime. It is hierarchy, typography, touch feedback, modality, and platform completeness. None of that requires a framework rewrite. Most of it is subtraction.

**In five sentences:**

1. The camera is the product, but it sits behind a form and a second modal.
2. The type is a poster, not an iOS text system.
3. The tab bar is a floating dock with a raised FAB, not an iOS tab bar.
4. Lime is doing six jobs; give it one.
5. On first launch there is more chrome explaining the app than collection to enjoy.

## 2. Scorecard

Judgment, not measurement.

| Dimension                  | Grade                        | Why                                                                          |
| -------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Brand & product soul       | **A−**                       | Rare Room is distinctive, warm, and internally coherent.                     |
| Data trust & honesty       | **A**                        | No invented ownership, prices, or confidence. Exceptional.                   |
| Information architecture   | **C+**                       | Five-destination rule is contradicted; "Sammlung" opens "Deine Binder."      |
| Visual hierarchy           | **C**                        | Too much chrome, too many primaries, too many nested panels.                 |
| Typography                 | **D+**                       | A poster voice applied to an operating surface. Fixed px, no Dynamic Type.   |
| Touch feedback             | **D**                        | Almost no `:active` state; hover on touch; swipe is a jump-cut.              |
| Gesture feel               | **C**                        | Sheets track the finger well; cards and binder pages do not.                 |
| iOS platform fidelity      | **C−**                       | Floating dock + FAB, no side safe areas, no contrast mode, no startup image. |
| Accessibility mechanics    | **B+**                       | Native dialog, focus return, skip link, 44px targets, 16px inputs.           |
| Accessibility completeness | **C−**                       | No Dynamic Type, no `prefers-contrast`, no `lang="ja"`, no VoiceOver pass.   |
| Performance discipline     | **C−**                       | 25–30px backdrop blurs on many panels plus WebGL glass, unmeasured.          |
| Maintainability            | **C**                        | 5,568-line stylesheet, 2,495-line add flow, no type/space tokens.            |
| QA depth                   | **A− behavioral / C visual** | Strong unit + 3-browser + axe coverage; no visual baselines.                 |

## 3. What is genuinely Apple-grade already

Credit where it is due — this is not a generic PWA:

- **The ethics are the product.** "Inspiration · kein eigener Bestand," confirmed-possession gates, dated price provenance, and honest empty states are better than many paid apps.
- **The mechanical accessibility is real.** Native `<dialog>`, focus trap and focus return, a skip link, `aria-current`, 44px targets almost everywhere, 16px inputs (no iOS focus zoom), reduced motion and reduced transparency support, and axe assertions in CI.
- **The test culture is serious.** Unit tests for domain rules, mobile Chromium touch injection, WebKit coverage, and update-safety tests. Most teams do not have this.
- **The brand discipline is clean.** Original vector lockup preserved, system fonts only, no cyan/midnight relapse, no fake rainbow holo, no font download.
- **Data-loss prevention is senior-level.** Sequential saves, update blocking while saving or editing, undo, and explicit error recovery.

This review is harsh because the foundation deserves it.

## 4. Findings

### P0 — fix before calling this iPhone-native

#### 1. The mobile navigation contradicts the product's own locked decision

`PRODUCT.md:29` explicitly preserves five primary mobile destinations: **Sammlung, Entdecken, + Karte, Binder, Profil**. The shipped dock is **Home, Entdecken, Scan, Sammlung, Profil** (`index.html:164–252`). The element labeled "Sammlung" routes to `#binder`, which renders the screen titled **"Deine Binder"** (`src/ui/binder-view.ts:78`). The actual "Karten" screen is one level deeper in the vault tabs (`src/ui/vault-tabs.ts:12–16`). There is no user-tested change justifying this, and the docs confirm there were no user tests.

The result is three names for one place: the tab says "Sammlung," the page says "Deine Binder," and the sub-tab says "Karten." On desktop, the header simultaneously offers "Meine Binder" _and_ "Sammlung," while the vault tabs repeat both destinations and two elements show `aria-current="page"` on the same screen.

**Why it matters:** the tab bar is the strongest spatial promise in an iPhone app. If tapping "Sammlung" opens "Deine Binder," the user cannot build a mental model of the app. The desktop duplication makes the same screen look like two locations.

**Fix:** pick one model. If Home stays, rename the tab to "Binder" and land on "Deine Binder," with "Karten" as the sub-tab. If the spec wins, remove Home and restore both Binder and Sammlung. Then update `PRODUCT.md` or the UI — not both ways.

#### 2. The camera is behind a form and a second modal

Home's "Karte live scannen" and the dock's Scan button call `openAdd({live:true})` (`src/ui/workspace.ts:564–565`). That opens the full **"Karten hinzufügen"** dialog (`src/ui/add-cards.ts:97–100`), and only then auto-clicks the live-scan action (`add-cards.ts:2491`), which opens a second `<dialog>` on top. Close the camera and you land back in the upload/catalog dialog, not on the screen you came from. The e2e tests even use `includeHidden: true` because of this stack.

This is the single biggest "web app" tell. A native scanner is one tap to a viewfinder; filing is a post-capture decision. The product's own `docs/HANDOFF.md` already flags that single-card camera and OCR can create nested dialogs.

**Fix:** make the live scanner a first-class surface opened directly from Home/Scan. Keep "Karten hinzufügen" as the explicit manual/catalog/file path. Closing the scanner returns to the origin screen. No nested dialogs.

#### 3. The empty collection has two identical lime primaries — and a third in the tab bar

On the empty collection screen:

- top: **"Karten hinzufügen"** primary → `ctx.openAdd()` (`src/ui/collection-view.ts:163`)
- hero: **"Erste Karte hinzufügen"** primary → the same `ctx.openAdd()` (`collection-view.ts:235`)
- dock: lime **Scan** → the same modal with live mode (`src/ui/workspace.ts:565`)

Two lime buttons on one screen perform the same action, and a third lime control sits in the dock. There is also "Foto erfassen" and "Mit Demo ausprobieren." Five actions for a first-run screen. Apple's rule is not "more entry points"; it is **one obvious next action**.

**Why it matters:** when everything is primary, nothing is. A first-time user has to choose between two identical buttons and a third scan entry before they own a single card.

**Fix:** one primary add action on the screen, one secondary "Demo" action, and the scan entry as the dock action. Remove the duplicate hero CTA. At 320px, stack the heading actions full-width instead of letting labels wrap.

#### 4. There is almost no touch-down feedback

A search of the app CSS finds exactly **three `:active` rules**: the legacy archive pocket, the legacy archive market button, and the mobile dock. Every other button, card, tab, and tile has no pressed state. The `w-button` transition animates `transform`, but nothing sets a pressed transform. Meanwhile there are many unguarded `:hover` rules — including `.w-button-card:hover { transform: translateY(-2px) }` (`src/workspace.css:606–609`). On iOS Safari, `:hover` is applied on tap and can stick, so a card can remain lifted after the sheet closes.

There is also **no haptics on the web**, so if the visual pressed state is missing too, the user gets no confirmation that the tap registered until the next screen appears. That is the opposite of iOS.

**Why it matters:** touch feedback is not decoration; it is the acknowledgement that the system heard you. Without it, every tap feels uncertain, especially on a slow network or while OCR is running.

**Fix:** add a consistent `:active` treatment (scale 0.98 / brightness / background) to every control, wrap all hover rules in `@media (hover: hover)`, and ensure pressed states do not animate back slowly. This is a one-day fix with a disproportionate effect.

#### 5. Typography is a poster, not an iOS text system

The current type system:

- body: **15px** (`src/styles.css:44`) versus iOS body's 17pt norm
- every `h1`, `h2`, `h3`, and dialog heading: **weight 900, letter-spacing −0.055em** (`src/workspace.css:15–29`)
- eyebrows: **10px monospace, uppercase, +0.12em** on nearly every page (`src/workspace.css:183–189`)
- brand tagline: **10px monospace** (`src/workspace.css:67–72`)
- version chip, result counts: 10–11px monospace
- dialog titles at 24px still inherit weight 900 and negative tracking

This is the Rare Room brand lab's _poster_ treatment applied to utility sheets. Apple uses SF Pro Display for large sizes and SF Pro Text for small ones; large titles are Bold or Semibold, not Black; tracking is size-dependent, and small text gets _positive_ tracking, not negative. `PRODUCT.md:37` lists **"excessive small uppercase labels and faux-tech monospace"** as an anti-reference. The UI is currently the anti-reference.

There is also no Dynamic Type hook: everything is fixed `px`, with no `-apple-system-body`, no `rem` ramp, and no large-text layout. A collector at night, one-handed, on an iPhone — the stated audience — gets 15px body copy that cannot grow.

**Why it matters:** type is the interface. A 900-weight, −5.5% heading at 32–48px reads as a campaign poster; at 19px inside a sheet it reads as a brand shouting in a utility drawer. The product's own tone is warm and quiet; the type is loud.

**Fix:** define a real ramp: 17px body, 15px secondary, 13px captions, 11px legal minimum; display `900/−5.5%` only for the hero and first-run empty-state headline; h2/h3 and dialog titles in 600–700 with normal tracking; replace the 10px mono eyebrows with 11–12px sans or remove them; add a Dynamic Type / `rem` path and test at 130–200% text. This will do more for the "Apple feel" than any glass effect.

### P1 — what keeps it feeling like a web app

#### 6. The page scanner asks for configuration before the photograph

`openPageScanner` creates the target-binder select and "Name des neuen Binders" field before the capture actions (`src/ui/page-scan.ts:135–147`), followed by a four-clause legalistic intro. The shutter is one of two equally weighted buttons below two form fields. On the committed 320px screenshot, the first screen is intro copy + target binder + binder name + two capture buttons; the primary save CTA is far below.

The physical action should come first. Where the page goes is a post-capture decision.

**Why it matters:** this is the second core flow, and it opens like a settings form instead of a camera. The user came to photograph a binder page, not to name a binder.

**Fix:** open to a viewfinder or a single "Binderseite fotografieren" surface. Move binder/name/language into a compact "Ablage" row after capture or into review. Shorten the intro to one sentence with a "So funktioniert's" disclosure.

#### 7. The tab bar is a floating dock with a raised FAB

`src/workspace.css:3304–3325` makes the dock a floating pill: 10px above the safe area, `100vw − 22px` wide, 28px radius, 30px backdrop blur. `3349–3359` makes the center Scan control a 56px lime circle with a 4px dark border, a lime outline, and a glow. Unselected items are full `var(--ink)` (`3328`), not gray; selected items get a lime tinted pill (`3336–3339`). Labels are fixed 10px.

Apple's tab bar is edge-to-edge, 49pt, uses tint for selection and gray for unselected, and does **not** put a floating action button in the tab bar. This reads as Material/Instagram, not iOS. The three-layer border/outline/glow on the Scan disc is also exactly the "glowing neon button" the anti-reference rules out.

**Why it matters:** the dock is on every screen. It is the most repeated visual statement in the app, and it currently says "web dashboard," not "iPhone."

**Fix:** make it a real tab bar (or a real custom dock, but then stop calling it an iOS tab bar). Use gray unselected icons, a single lime tint for the selected item, filled selected icons, no raised FAB, no glow. If Scan must be prominent, make it the selected state of a normal tab or a persistent bottom action above the bar, not a floating orb.

#### 8. Home is a landing page, not a dashboard

`src/ui/home-view.ts` renders, in order: hero (with card fan) → quick actions → first-run steps → stats → recent cards → sets → portfolio promo. For a returning user, the actual collection — "Zuletzt hinzugefügt" — comes after the hero, the quick grid, and three stat tiles. On a 390×844 screen, the user's own cards are at or below the fold. The hero copy is still "Deine Sammlung. Deine Geschichte." plus two CTAs.

`PRODUCT.md:13` says the main app is **Operate**: "the scanned card and its artwork are the hero; the interface gets out of the way." Home currently behaves like **Persuade** every time, even after the user has collected for weeks.

**Why it matters:** the app icon opens Home. If Home is a marketing page, the product feels like a website with an app wrapper. Returning users want their cards, their current page, their next scan — not a re-introduction.

**Fix:** make the returning Home a dashboard: the current binder page or recent cards first, a compact greeting, one primary scan action. Keep the three-step onboarding only for first run, and collapse it after the first card. Move the portfolio promo into Portfolio. The marketing hero belongs on the share/landing surface, not behind the app icon.

#### 9. Binder: the page is not the hero, and the nine slots are rendered twice on desktop

`renderBinders` puts the page heading, two CTAs, the binder title, and page-management controls before the 3×3 paper. The paper itself is followed by a page rail, toolbar, and info block. On desktop, the page inspector is **open by default** (`src/ui/binder-view.ts:550–552`) and lists all nine slots again — the same information as the 3×3, in a second representation. On mobile it is collapsed, which mitigates but does not remove the duplication.

**Why it matters:** the 3×3 physical page is the emotional centerpiece of the product. It should be the first thing under a compact title, not the last thing after the setup chrome. On desktop the user sees the page twice and edits it in two places.

**Fix:** title → page (3×3) → page rail → toolbar. Move "Seitens vorschlagen / Vorlage übernehmen / Seite verwalten" into a single toolbar under the page or a "…" sheet. Remove the desktop duplicate nine-row inspector; make each pocket the editor. Keep the page rail — it is genuinely good.

#### 10. Gestures are inconsistent, and a sheet can discard unsaved work

The sheet gesture is well built: it tracks the finger, uses a distance/velocity threshold (`src/ui/sheet-gestures.ts:8–17`), respects reduced motion, and keeps the close button. The card and binder swipes are not: `enableSwipe` waits for a 50px horizontal threshold (`src/domain/navigation.ts:28–34`) and then jumps to the next card. Nothing follows the finger; the binder adds a 190ms enter animation, the card detail has no transition at all. That is a threshold-triggered button wearing a swipe costume.

Worse: **every** modal gets `enableSheetDrag` (`src/ui/workspace-dom.ts:216`), and dragging the header or tapping the backdrop closes it (`203–212`) without checking for dirty fields. A typed binder name, a note, or a selected card can be discarded silently. The collection card detail protects unsaved edits against _swiping between cards_ but not against dragging the sheet away.

**Why it matters:** a gesture that does not track the finger does not feel native; a gesture that discards work breaks trust. The app is otherwise meticulous about confirmation, so this is a contradiction in its own interaction language.

**Fix:** either implement direct manipulation for horizontal swipes (translate the artwork, track dx, commit on velocity, spring back below threshold) or remove the swipe affordance. Add a dirty-state guard to sheet dismissal, or auto-save drafts. Replace `window.confirm` (`src/ui/workspace.ts:587`, `src/ui/add-cards.ts:592`) with the app's own confirmation sheet.

#### 11. Lime is doing six jobs

Lime currently means: primary CTA, selected tab, selected vault segment, the floating Scan orb (plus glow), the focus ring, portfolio values, and active scan progress. On the 320px empty collection you can see four lime elements at once: the top primary, the hero primary, the Scan disc, and the selected tab.

Accent color loses meaning when it means everything. Apple uses tint for interactive/selection and keeps data/status in neutral or semantic colors.

**Why it matters:** if lime is both "tap me" and "you are here" and "this number is money" and "this is focused," the user cannot read the visual language without learning it. The brand becomes noise instead of signature.

**Fix:** lime = one primary action per screen + selected state. Use a neutral fill for the segmented control, white/high-contrast for focus, and bone for monetary values. Remove the glows. The brand will feel _more_ premium, not less.

#### 12. The iOS platform surface is incomplete

These are small individually, but together they are the difference between "website" and "app":

- **No left/right safe-area handling anywhere.** A search finds only `safe-area-inset-top` and `-bottom`. The manifest has no `orientation` lock (`vite.config.ts:48–79`). In landscape on a notched iPhone, the header, dock, and content can sit under the sensor housing. Either add all four insets or lock portrait.
- **No `prefers-contrast` / Increase Contrast path**, and the app is forced dark (`index.html:10`, `src/styles.css`). A dark-only brand is a valid choice, but iOS users expect the accessibility variants to work.
- **No Dynamic Type path** (see finding 5).
- **Japanese card names have no `lang="ja"`.** A search finds no `lang` attributes in `src`. VoiceOver will read Japanese names with a German voice. The product explicitly supports Japanese metadata.
- **No standard favicon, no Open Graph/Twitter card, no `apple-touch-startup-image`.** `index.html:1–25` has only the Apple touch icon. Sharing the GitHub Pages link produces no preview card; launching from the home screen can flash white/black before the app paints.
- **The version chip is developer chrome in the persistent status strip** (`index.html:112–119`). It is ~22px tall, below the 44px target, and sits on every screen. The handoff calls it screenshot proof — fine for beta, wrong for a lovebrand release. Move it to Profil → Über.
- **Footer links have no 44px tap target**; they are plain text links. On mobile, they are easy to miss and easy to mistap.

**Why it matters:** users do not consciously notice these, but they feel them. A missing startup image, a tab that does not respect the notch, a Japanese name read in German — each one says "this was built for a browser first."

**Fix:** handle all four safe-area insets or lock portrait; add `prefers-contrast` and a dark-only note; add `lang="ja"` to localized names; add a favicon, OG/Twitter metadata, and an Apple startup image; move the version chip to Profil; give footer links 44px hit areas.

### P2 — craft and engineering hygiene

#### 13. Glass is expensive and largely invisible

`.w-glass-panel` applies `backdrop-filter: blur(25px) saturate(165%)` plus a large shadow (`src/workspace.css:2956–2963`). On a returning Home screen it is used on the hero, each stat tile, each set row, the portfolio promo, and the vault tabs — roughly 7–10 blurred layers. The dock adds `blur(30px)` and a third-party WebGL refraction layer over `#workspace-main` (`src/ui/collector-polish.ts:29–40`). Dialogs add another 30px blur plus a 9px backdrop blur.

The background is nearly flat `#141519`. At 87% opacity, the panels look like solid dark cards in the screenshots. You are paying iPhone GPU/battery cost for an effect the user cannot see. The comment says "one refracting material, not 80 glass panels" — the intent is right, but the CSS still creates many.

And there is **no real-device FPS/battery trace**; the docs explicitly say no physical iPhone test. A decorative WebGL layer on the primary navigation is not something to ship unmeasured.

**Why it matters:** performance is a feature on a phone. Multiple stacked backdrop filters over a scrolling page are a known cost; a WebGL context on the dock is another. The visual return is close to zero on a flat dark background.

**Fix:** keep one material on the dock and sheets; remove `backdrop-filter` from content panels and use solid tints. Measure the dock optic on/off on an iPhone 13 Pro Max (scroll FPS, memory, battery, low-power mode). Disable the optic on low-end/low-power. You will likely gain performance and lose nothing visually.

#### 14. Routing, focus, and motion details

- `hashchange` **and** `popstate` both call `ctx.render()` (`src/ui/workspace.ts:616–617`). Back navigation between hashes fires both, so the view renders twice.
- `navigate()` focuses `<main>` and scrolls to top (`293–299`), but Back/Forward do not get the same focus or screen announcement. `<main>` has no accessible name, so VoiceOver announces "main," not the new screen title.
- Route changes trigger a 360ms fade-up of whole sections (`src/ui/collector-polish.ts:65–69`). That is a marketing-page motion, not an iOS tab transition. Native tab switches are instant; if animated, they are spatial.
- `body:has(.w-dialog[open]) { overflow: hidden }` (`src/workspace.css:943–945`) is a known iOS scroll-position trap. Verify that closing a dialog from deep in a long collection does not jump the page.

**Why it matters:** a native app never loses the user's place silently. Double renders and missing focus announcements are invisible on a fast desktop and very visible to a screen-reader user.

**Fix:** one route-change handler; move focus to the `h1` (tabindex −1) and announce the screen; remove or shorten the route fade; verify scroll restoration on iOS.

#### 15. First paint is chrome-first

On first launch in iOS Safari, the order is: 66px header + ~44px status strip + an in-flow install/offline banner inserted after the status (`src/pwa.ts:84–85, 189–196`) + page heading. The committed screenshot shows a ~168px offline banner. That is up to **~278px — a third of a 390×844 screen — before the H1**. The banner is a block that pushes content, not a toast; the offline-ready dismissal is not remembered across sessions.

**Why it matters:** the first launch is the product's handshake. Right now it is a storage label, a save status, and a system banner before the user sees a card.

**Fix:** move install/offline messaging to a compact toast above the dock or a row in Profil; show once; never shift the first paint. Move storage status and version into Profil. The original bet — "without an account, local first" — does not need a permanent status strip to be believed.

#### 16. The codebase needs a design system, not more one-off CSS

`src/workspace.css` is **5,568 lines**; `src/ui/add-cards.ts` is **2,495 lines**; `src/ui/page-scan.ts` is **1,303**. Color tokens exist, but type, spacing, radii, and elevations are mostly literals. I counted radii from 8 to 28px on a single screen. There are dead rules (a 6-column mobile nav rule for 5 items at `src/workspace.css:2923–2925`), repeated `.w-mobile-nav` blocks, and order-dependent overrides. The result works because the team is disciplined, but the next contributor will drift.

**Why it matters:** visual consistency is currently maintained by memory, not structure. Every new screen re-invents spacing and type; every CSS change risks a later rule overriding it. An Apple-grade interface needs a small, enforced vocabulary.

**Fix:** introduce tokens for type/space/radius/elevation; split the add flow into a state machine plus view modules; consolidate the CSS into layers or component files; add screenshot baselines at 320/390/430, large text, reduced motion, and dark/light. Behavioral tests cannot catch "the primary CTA wraps to three lines." The current 320 tests prove _no horizontal overflow_, not _no visual failure_.

## 5. The 320px proof

`docs/screenshots/rare-room-v2/collection-320.png` is the most useful evidence because its five-tab dock matches the current build:

1. **"Karten hinzufügen" wraps to three lines** while the adjacent "Foto erfassen" wraps to two. The two buttons have different heights and look broken. Cause: two `flex: 1` buttons in one row at 320 (`src/workspace.css:1518–1523`) with no stacking and no `white-space` strategy.
2. **The header has almost no slack.** A 174px logo + two 44px actions + gaps + 32px page padding consumes ~300 of 320px. Any larger text setting or longer locale will break it.
3. **The status strip wraps to two lines** before the page title. On first launch, the PWA banner adds three more lines above the H1.
4. **The dock is a floating pill with a 56px FAB**; the page content scrolls behind it, and the tab labels are fixed at 10px.

This is why "we test 320px" is not the same as "320px is good." The current tests check for overflow; they do not judge hierarchy. Add visual assertions for label line count and first-content position.

## 6. The strongest argument is your own PRODUCT.md

You wrote the review for me:

- `PRODUCT.md:13` — "The interface gets out of the way."
- `PRODUCT.md:29` — five mobile destinations: Sammlung, Entdecken, + Karte, Binder, Profil.
- `PRODUCT.md:37` — anti-references: "excessive small uppercase labels and faux-tech monospace; cards nested inside decorative cards; glowing neon buttons."

The shipped UI has 10px mono uppercase eyebrows on every page, nested glass panels with large shadows, a glowing lime Scan orb, and a mobile nav that replaces Binder with Home while pointing "Sammlung" at the binder screen. This is not a matter of taste. It is a gap between the written standard and the implementation. Closing that gap will do more for the product than any new visual idea.

## 7. Two-week implementation sequence

| Order | Change                                                                                                                                                     | Acceptance criterion                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1     | **Fix mobile IA** — one model: either Home + Binder + Karten, or the spec's Binder + Sammlung                                                              | Tab label matches landing title; exactly one active nav item; no duplicate desktop rows; `PRODUCT.md` and UI agree |
| 2     | **One-surface camera** — live scanner opens directly from Home/Scan; Add dialog is a separate manual/file path                                             | One tap from Home/Scan to viewfinder; closing returns to origin; no stacked dialogs                                |
| 3     | **One-primary pass** — dedupe collection CTAs; stack heading actions at 320                                                                                | Empty collection has one lime primary; no 3-line labels; equal button heights                                      |
| 4     | **Touch feedback + dirty guard** — `:active` everywhere; hover behind `(hover:hover)`; confirm before discarding; replace `window.confirm`                 | Every control responds on touch-down; drag/backdrop never silently loses typed data                                |
| 5     | **Type ramp** — 17px body; display treatment only for hero; semibold utility headings; remove mono eyebrows; Dynamic Type path                             | No 10px body/metadata; text scales; 320px and large text do not clip                                               |
| 6     | **Capture-first page scan** — shutter first, filing after                                                                                                  | Shutter is the first focusable action; zero required fields before capture; one-sentence intro                     |
| 7     | **iOS completeness** — side safe areas or portrait lock; 44px version/footer; `lang="ja"`; `prefers-contrast`; favicon/OG/startup image; move version chip | Landscape notch safe; all interactive targets ≥44px; share preview and launch screen exist                         |
| 8     | **Performance + visual QA** — remove content-panel blur; measure the WebGL dock on/off; screenshot baselines                                               | Measured iPhone scroll trace; baselines at 320/390/430 + large text + reduced motion                               |

None of this requires a framework migration, a new font, or a new brand direction. It is almost entirely subtraction and platform alignment.

## 8. What I would not touch

- The confirmation-before-ownership model.
- The source/date/currency labeling and "no invented price" rule.
- The "Inspiration · kein eigener Bestand" honesty.
- Native dialogs, focus return, skip link, 16px inputs, 44px majority.
- Reduced motion and reduced transparency handling.
- System fonts, the original vector lockup, and the Rare Room palette.
- The native TypeScript/DOM architecture and the strong test culture.

Those are the parts that already feel like a product with a conscience.

## 9. Limits of this review

- This is a static review of code, docs, and committed screenshots. It is not a substitute for holding the app in one hand on an iPhone 13 Pro Max, with Safari, a real camera, a screen reader, and large text.
- I did not run `npm run check` or the Playwright suite in this session. The review does not claim a green build.
- Some screenshots predate the current navigation. Findings were re-checked against the current code where possible; the code is the authority.
- No collector interviews, recognition benchmarks, or physical binder setups were performed. The review does not claim any.
- The grades are a senior-review judgment, not a measurement.

## 10. Bottom line

E-Binder is **trustworthy before it is beautiful**, which is the right order. But it is not yet **felt** like an iOS app: the camera is behind a form, the type is a poster, the tab bar is a dock with a FAB, the lime is doing six jobs, and the first screen is often chrome explaining the product instead of the collection itself.

The next release should not add another glass panel. It should remove three, move the camera to the front, raise the body text, make every tap answer back, and give each screen one obvious next action. That is what Apple-grade actually is: fewer decisions, bigger content, immediate feedback, and nothing between the collector and the card.

**The product has earned the right to be simple. The interface hasn't cashed that in yet.**
