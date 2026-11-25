import type { CardData } from './types';

/** Read the creator's name field consistently across work surfaces. */
export const getCardTitle = (card: { data: CardData }, index: number): string => {
  const canonical = [card.data.cardName, card.data.name, card.data.title]
    .find((value) => value != null && String(value).trim());
  if (canonical !== undefined) return String(canonical);
  const authored = Object.entries(card.data).find(([key, value]) => (
    /^(?:card[\s_-]*)?(?:name|title)$/i.test(key.trim())
      && value != null && String(value).trim()
  ));
  return String(authored?.[1] ?? `Card ${index + 1}`);
};
