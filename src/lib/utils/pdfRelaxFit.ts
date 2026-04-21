import type { BodyComp } from '$lib/types';

/**
 * Parser de PDF exportado pelo app Relax Fit / Picooc.
 * Usa PDF.js carregado dinamicamente pra evitar inchar o bundle inicial.
 *
 * Estratégia:
 * 1. Extrai texto completo do PDF
 * 2. Normaliza (remove acentos, deixa tudo em minúsculo pra matching)
 * 3. Procura pares "rótulo ... número" com regex por campo
 * 4. Se falha em campos críticos, o chamador pode cair no Gemini fallback
 */

export interface ParsedBody {
  date?: string;
  peso?: number;
  fat?: number;
  subcutaneousFat?: number;
  muscle?: number;
  skeletalMuscle?: number;
  smi?: number;
  protein?: number;
  visceral?: number;
  hydration?: number;
  bone?: number;
  tmb?: number;
  metabolicAge?: number;
  bodyScore?: number;
  targetWeight?: number;
  _raw?: string;
  _missing: string[];
}

export async function extractPdfText(file: File): Promise<string> {
  // Carrega PDF.js via CDN pra evitar peso no bundle
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/+esm' as string);
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    full += content.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return full;
}

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Extrai um número que aparece logo após um label.
 * Aceita formatos "23,5 kg", "23.5%", "1.800 kcal", etc.
 */
function findValue(text: string, labelVariants: string[], opts?: { integer?: boolean; minDigits?: number }): number | undefined {
  for (const label of labelVariants) {
    // Aceita até 40 chars entre o label e o número pra lidar com colunas
    const re = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\d]{0,40}?(\\d{1,3}(?:[.,]\\d{1,2})?)`,
      'i'
    );
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(',', '.'));
      if (Number.isFinite(n)) {
        if (opts?.integer) return Math.round(n);
        return n;
      }
    }
  }
  return undefined;
}

export function parseRelaxFitText(raw: string): ParsedBody {
  const text = normalize(raw);
  const result: ParsedBody = { _raw: raw, _missing: [] };

  // Data — aceita DD/MM/YYYY ou YYYY-MM-DD
  const dateMatch =
    text.match(/(\d{2})\/(\d{2})\/(\d{4})/) ??
    text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    if (dateMatch[0].includes('/')) {
      result.date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    } else {
      result.date = dateMatch[0];
    }
  }

  // Peso
  result.peso = findValue(text, ['peso corporal', 'peso', 'weight']);
  if (!result.peso) result._missing.push('peso');

  // % Gordura
  result.fat = findValue(text, ['gordura corporal', '% de gordura', 'percentual de gordura', 'body fat']);
  if (!result.fat) result._missing.push('fat');

  // Massa muscular
  result.muscle = findValue(text, ['massa muscular', 'musculo', 'muscle mass']);
  if (!result.muscle) result._missing.push('muscle');

  // Gordura visceral
  result.visceral = findValue(text, ['gordura visceral', 'grau de gordura visceral', 'visceral fat'], { integer: true });

  // Gordura subcutânea
  result.subcutaneousFat = findValue(text, ['gordura subcutanea', 'subcutaneous fat']);

  // Hidratação / Água corporal
  result.hydration = findValue(text, ['agua corporal', 'hidratacao', 'body water', '% de agua']);

  // Massa óssea / Sal inorgânico
  result.bone = findValue(text, ['sal inorganico', 'massa ossea', 'osso', 'bone mass']);

  // Proteína (kg)
  result.protein = findValue(text, ['proteina (kg)', 'proteina', 'protein']);

  // Músculo esquelético (separado do muscle total)
  result.skeletalMuscle = findValue(text, ['musculo esqueletico', 'skeletal muscle']);

  // SMI — índice massa muscular esquelética
  result.smi = findValue(text, ['smi', 'indice de massa muscular esqueletica']);

  // Pontuação corporal (score)
  result.bodyScore = findValue(text, ['pontuacao corporal', 'pontuacao total', 'body score'], { integer: true });

  // Peso alvo
  result.targetWeight = findValue(text, ['peso alvo', 'target weight']);

  // TMB / BMR
  result.tmb = findValue(text, ['taxa metabolica basal', 'taxa metabolica', 'tmb', 'bmr', 'metabolismo basal'], { integer: true });

  // Idade metabólica / Idade do corpo
  result.metabolicAge = findValue(text, ['idade do corpo', 'idade metabolica', 'metabolic age'], { integer: true });

  // Validações de sanidade — descarta valores absurdos
  if (result.peso && (result.peso < 20 || result.peso > 300)) { delete result.peso; result._missing.push('peso'); }
  if (result.fat && (result.fat < 2 || result.fat > 70)) { delete result.fat; result._missing.push('fat'); }
  if (result.muscle && (result.muscle < 10 || result.muscle > 150)) { delete result.muscle; result._missing.push('muscle'); }

  return result;
}

/**
 * Retorna true se o parser conseguiu extrair o essencial.
 * Se não, caller deve tentar Gemini.
 */
export function isParseOK(parsed: ParsedBody): boolean {
  // Critério: pelo menos peso + (%gordura OU massa muscular)
  return !!parsed.peso && (!!parsed.fat || !!parsed.muscle);
}

export function toBodyComp(parsed: ParsedBody, fallbackDate: string): Omit<BodyComp, 'createdAt'> {
  return {
    date: parsed.date ?? fallbackDate,
    peso: parsed.peso,
    fat: parsed.fat,
    subcutaneousFat: parsed.subcutaneousFat,
    muscle: parsed.muscle,
    skeletalMuscle: parsed.skeletalMuscle,
    smi: parsed.smi,
    protein: parsed.protein,
    visceral: parsed.visceral,
    hydration: parsed.hydration,
    bone: parsed.bone,
    tmb: parsed.tmb,
    metabolicAge: parsed.metabolicAge,
    bodyScore: parsed.bodyScore,
    targetWeight: parsed.targetWeight,
    source: 'pdf-relaxfit'
  };
}
