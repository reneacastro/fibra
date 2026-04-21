import type { Food } from '$lib/types';

/**
 * Cliente pro Open Food Facts (grátis, tem produtos brasileiros).
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

const BASE = 'https://br.openfoodfacts.org';

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_pt?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy_100g'?: number;
    'proteins_100g'?: number;
    'carbohydrates_100g'?: number;
    'fat_100g'?: number;
    'fiber_100g'?: number;
  };
  image_small_url?: string;
  serving_size?: string;
}

function productToFood(p: OFFProduct): Food | null {
  if (!p.nutriments) return null;
  const kcal = p.nutriments['energy-kcal_100g']
    ?? (p.nutriments['energy_100g'] ? Math.round(p.nutriments['energy_100g'] / 4.184) : undefined);
  if (!kcal) return null;

  return {
    id: `off_${p.code ?? Math.random().toString(36).slice(2)}`,
    name: p.product_name_pt ?? p.product_name ?? 'Sem nome',
    brand: p.brands?.split(',')[0]?.trim(),
    barcode: p.code,
    servingSize: 100,
    kcalPer100g: Math.round(kcal),
    proteinPer100g: Math.round((p.nutriments.proteins_100g ?? 0) * 10) / 10,
    carbPer100g: Math.round((p.nutriments.carbohydrates_100g ?? 0) * 10) / 10,
    fatPer100g: Math.round((p.nutriments.fat_100g ?? 0) * 10) / 10,
    fiberPer100g: p.nutriments.fiber_100g
      ? Math.round(p.nutriments.fiber_100g * 10) / 10
      : undefined,
    source: 'off'
  };
}

export async function searchFoods(query: string, limit = 20): Promise<Food[]> {
  const q = encodeURIComponent(query.trim());
  const url = `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=${limit}&lc=pt`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Busca falhou');
  const data = await res.json();
  const products: OFFProduct[] = data.products ?? [];
  return products.map(productToFood).filter((x): x is Food => x !== null);
}

export async function findByBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return productToFood(data.product);
}

/** Catálogo inicial com alguns alimentos brasileiros comuns (TACO) pra busca rápida offline */
export const TACO_BASICS: Food[] = [
  { id: 'taco-arroz-cozido', name: 'Arroz branco cozido', servingSize: 100, kcalPer100g: 128, proteinPer100g: 2.5, carbPer100g: 28.1, fatPer100g: 0.2, fiberPer100g: 1.6, source: 'taco' },
  { id: 'taco-feijao-carioca', name: 'Feijão carioca cozido', servingSize: 100, kcalPer100g: 76, proteinPer100g: 4.8, carbPer100g: 13.6, fatPer100g: 0.5, fiberPer100g: 8.5, source: 'taco' },
  { id: 'taco-frango-peito', name: 'Peito de frango grelhado', servingSize: 100, kcalPer100g: 159, proteinPer100g: 32, carbPer100g: 0, fatPer100g: 3.2, source: 'taco' },
  { id: 'taco-ovo', name: 'Ovo de galinha inteiro cozido', servingSize: 50, kcalPer100g: 146, proteinPer100g: 13.3, carbPer100g: 0.6, fatPer100g: 9.5, source: 'taco' },
  { id: 'taco-batata-doce', name: 'Batata-doce cozida', servingSize: 100, kcalPer100g: 77, proteinPer100g: 0.6, carbPer100g: 18.4, fatPer100g: 0.1, fiberPer100g: 2.2, source: 'taco' },
  { id: 'taco-aveia', name: 'Aveia em flocos', servingSize: 30, kcalPer100g: 394, proteinPer100g: 13.9, carbPer100g: 66.6, fatPer100g: 8.5, fiberPer100g: 9.1, source: 'taco' },
  { id: 'taco-banana', name: 'Banana-nanica', servingSize: 86, kcalPer100g: 92, proteinPer100g: 1.4, carbPer100g: 23.8, fatPer100g: 0.1, fiberPer100g: 1.9, source: 'taco' },
  { id: 'taco-maca', name: 'Maçã com casca', servingSize: 130, kcalPer100g: 56, proteinPer100g: 0.3, carbPer100g: 15.2, fatPer100g: 0, fiberPer100g: 1.3, source: 'taco' },
  { id: 'taco-leite-integral', name: 'Leite integral', servingSize: 200, kcalPer100g: 58, proteinPer100g: 2.9, carbPer100g: 4.3, fatPer100g: 3.2, source: 'taco' },
  { id: 'taco-pao-frances', name: 'Pão francês', servingSize: 50, kcalPer100g: 300, proteinPer100g: 8, carbPer100g: 58.6, fatPer100g: 3.1, fiberPer100g: 2.3, source: 'taco' },
  { id: 'taco-queijo-minas', name: 'Queijo minas frescal', servingSize: 30, kcalPer100g: 240, proteinPer100g: 17.4, carbPer100g: 3.2, fatPer100g: 17.3, source: 'taco' },
  { id: 'taco-whey', name: 'Whey protein (padrão)', servingSize: 30, kcalPer100g: 400, proteinPer100g: 80, carbPer100g: 8, fatPer100g: 5, source: 'taco' },
  { id: 'taco-azeite', name: 'Azeite de oliva', servingSize: 10, kcalPer100g: 884, proteinPer100g: 0, carbPer100g: 0, fatPer100g: 100, source: 'taco' },
  { id: 'taco-abacate', name: 'Abacate', servingSize: 100, kcalPer100g: 96, proteinPer100g: 1.2, carbPer100g: 6, fatPer100g: 8.4, fiberPer100g: 6.3, source: 'taco' },
  { id: 'taco-tapioca', name: 'Tapioca (goma)', servingSize: 50, kcalPer100g: 242, proteinPer100g: 0.2, carbPer100g: 60, fatPer100g: 0, source: 'taco' }
];
