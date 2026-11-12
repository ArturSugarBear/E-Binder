-- Labels require independent visual/catalogue evidence. Predictions remain pending.
-- Existing owner RLS and the absence of authenticated UPDATE grants stay intact.
alter table public.beta_scan_samples
  add column if not exists verified_language text check (verified_language in ('de','en','ja')),
  add column if not exists verified_finish text check (verified_finish in ('normal','holo','reverse','other')),
  add column if not exists reviewed_by text,
  add column if not exists review_method text check (review_method in ('human-visual-catalog','assisted-visual-catalog')),
  add column if not exists image_sha256 text,
  add column if not exists review_evidence text,
  add column if not exists human_verified boolean not null default false;

alter table public.beta_scan_samples add constraint beta_review_evidence_required check (
  review_status <> 'accepted' or (
    verified_language is not null and verified_finish is not null
    and verified_card_id ~ '^tcgdex:(de|en|ja):[A-Za-z0-9.+-]+$'
    and split_part(verified_card_id, ':', 2) = verified_language
    and length(trim(reviewed_by)) between 3 and 200
    and review_method is not null
    and image_sha256 ~ '^[0-9a-f]{64}$'
    and length(trim(review_evidence)) between 20 and 2000
    and reviewed_by is not null and image_sha256 is not null and review_evidence is not null
  )
);
alter table public.beta_scan_samples add constraint beta_human_verification_required check (
  not human_verified or (review_status = 'accepted' and review_method = 'human-visual-catalog')
);

comment on column public.beta_scan_samples.human_verified is
  'Only an explicit human visual review may set this. Assisted labels and OCR predictions are excluded from training exports.';
