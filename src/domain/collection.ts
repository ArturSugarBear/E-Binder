import { z } from 'zod';

const text = z.string().trim().min(1);
const cardId = z.string().regex(/^[a-zA-Z0-9_-]+$/);

export const cardSchema = z
  .object({
    id: cardId,
    name: text,
    number: text,
    set: text,
    type: z.enum([
      'colorless',
      'dark',
      'dragon',
      'electric',
      'fighting',
      'fire',
      'grass',
      'metal',
      'psychic',
      'trainer',
      'water',
    ]),
    facts: text,
    price: text,
    lowest: text,
    average30: text,
    cardmarket: z
      .string()
      .regex(
        /^https:\/\/www\.cardmarket\.com\/en\/Pokemon\/Products\?idProduct=[1-9]\d*$/,
      ),
  })
  .strict();

const chapterSchema = z
  .object({
    title: text,
    description: text,
    value: text.optional(),
    theme: z.literal('greninja').optional(),
    edition: text.optional(),
    priceDate: text.optional(),
    covers: z.array(cardId).length(3),
    cards: z.array(cardSchema).length(9),
  })
  .strict()
  .superRefine((chapter, ctx) => {
    const ids = new Set<string>();
    for (const card of chapter.cards) {
      if (ids.has(card.id))
        ctx.addIssue({ code: 'custom', message: `Duplicate card ${card.id}` });
      ids.add(card.id);
    }
    for (const cover of chapter.covers) {
      if (!ids.has(cover))
        ctx.addIssue({
          code: 'custom',
          message: `Unknown chapter cover ${cover}`,
        });
    }
  });

export const collectionSchema = z.array(chapterSchema).min(1);
export type Card = z.infer<typeof cardSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type Collection = z.infer<typeof collectionSchema>;

export function parseCollection(input: unknown): Collection {
  return collectionSchema.parse(input);
}
