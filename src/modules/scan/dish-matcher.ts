// Reconnaissance d'un plat à partir d'une description texte libre (saisie au
// clavier ou transcrite depuis la voix côté mobile), sans modèle ML.
// Port serveur de src/ai/text/matchDishByDescription.ts (kfl frontend) — la
// logique et le corpus doivent rester synchronisés entre les deux projets ;
// c'est le port serveur qui fait foi pour l'historique/XP persistés en base.
import dishDescriptions from './data/dish_descriptions.json';

export const UNKNOWN_CLASS = 'inconnu';

interface DishEntry {
  nomFR: string;
  nomEN: string;
  region?: string;
  ingredients: string[];
  aliases?: string[];
}

const DB = dishDescriptions as unknown as Record<string, DishEntry>;

const STOPWORDS = new Set([
  'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'et', 'avec', 'dans',
  'pour', 'au', 'aux', 'en', 'sur', 'ou', 'qui', 'que', 'ce', 'cette', 'ca',
  'je', 'cherche', 'recherche', 'plat', 'contient', 'contenant', 'fait',
  'tres', 'plus', 'comme', 'cest', 'il', 'y', 'a', 'est', 'sont', 'voir',
  'mange', 'manger', 'veux', 'voudrais', 'voulez',
]);

const PHONETIC_MAP: Record<string, string> = {
  'endolé': 'ndolé',
  'andole': 'ndole',
  'un dolé': 'ndole',
  'un dole': 'ndole',
  'indole': 'ndole',
  'ndolée': 'ndole',
  'aidole': 'ndole',
  'poulet dg': 'poulet dg',
  'poulet tg': 'poulet dg',
  'poule dg': 'poulet dg',
  'mbongot': 'mbongo',
  'mboncho': 'mbongo',
  'mbonjo': 'mbongo',
  'woakye': 'waakye',
  'waki': 'waakye',
  'waaki': 'waakye',
  'écoang': 'ekwang',
  'écouang': 'ekwang',
  'aquang': 'ekwang',
  'jolloff': 'jollof',
  'joloff': 'jollof',
};

function applyPhoneticFixes(s: string): string {
  let result = s;
  for (const [typo, correct] of Object.entries(PHONETIC_MAP)) {
    result = result.replace(new RegExp(typo, 'gi'), correct);
  }
  return result;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(s: string): string[] {
  return normalize(s).split(' ').filter((tok) => tok.length > 2 && !STOPWORDS.has(tok));
}

export interface DescriptionMatch {
  classId: string;
  confidence: number;
}

export function matchDishByDescription(rawText: string): DescriptionMatch {
  const fixed = applyPhoneticFixes(rawText);
  const inputNorm = normalize(fixed);
  if (!inputNorm) return { classId: UNKNOWN_CLASS, confidence: 0 };
  const inputTokens = new Set(significantTokens(fixed));

  let bestId: string | null = null;
  let bestScore = 0;

  for (const [id, dish] of Object.entries(DB)) {
    let score = 0;

    const allAliases = dish.aliases ?? [];
    for (const alias of allAliases) {
      const aliasNorm = normalize(alias);
      if (aliasNorm && inputNorm.includes(aliasNorm)) {
        score += 5;
        break;
      }
    }

    for (const name of [dish.nomFR, dish.nomEN]) {
      const nameNorm = normalize(name);
      if (!nameNorm) continue;
      if (inputNorm.includes(nameNorm)) {
        score += 4;
      } else {
        const nameTokens = significantTokens(name);
        const hits = nameTokens.filter((tok) => inputTokens.has(tok)).length;
        score += Math.min(hits * 2, 4);
      }
    }

    for (const ingredient of dish.ingredients) {
      const ingNorm = normalize(ingredient);
      if (ingNorm && inputNorm.includes(ingNorm)) {
        score += 3;
        continue;
      }
      const ingTokens = significantTokens(ingredient);
      const hits = ingTokens.filter((tok) => inputTokens.has(tok)).length;
      score += Math.min(hits, 2);
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  if (!bestId || bestScore < 2) {
    return { classId: UNKNOWN_CLASS, confidence: 0 };
  }

  const confidence = Math.max(0.35, Math.min(0.95, 0.35 + bestScore * 0.07));
  return { classId: bestId, confidence };
}

export function getDishRegion(classId: string): string {
  return DB[classId]?.region ?? '';
}
