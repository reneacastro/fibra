import { env } from '$env/dynamic/public';

/**
 * Cliente mínimo pro Gemini 2.0 Flash.
 * Tier grátis: 15 req/min, 1.5M tokens/dia — suficiente pra uso pessoal.
 * Docs: https://ai.google.dev/api/generate-content
 */

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
// gemini-flash-latest é alias sempre apontando pro modelo Flash estável atual —
// evita quebrar quando Google descontinua versão específica
const MODEL = 'gemini-flash-latest';

export interface GeminiOptions {
  responseMimeType?: 'text/plain' | 'application/json';
  responseSchema?: object;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ImagePart {
  inlineData: { mimeType: string; data: string /* base64, sem prefixo */ };
}

export async function askGemini(
  prompt: string,
  opts: GeminiOptions = {},
  images?: ImagePart[]
): Promise<string> {
  const key = env.PUBLIC_GEMINI_API_KEY;
  if (!key) throw new Error('PUBLIC_GEMINI_API_KEY não configurada');

  const parts: unknown[] = [{ text: prompt }];
  if (images?.length) parts.push(...images.map((i) => ({ inline_data: i.inlineData })));

  const res = await fetch(`${API_URL}/${MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
        responseMimeType: opts.responseMimeType ?? 'text/plain',
        ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {})
      }
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia do Gemini');
  return text;
}

const BODY_COMP_SCHEMA_PROMPT = `Campos possíveis (omita os que não encontrar, use números puros sem unidades):
- date (YYYY-MM-DD)
- peso (kg)
- fat (% de gordura corporal)
- subcutaneousFat (% gordura subcutânea)
- muscle (kg massa muscular total)
- skeletalMuscle (kg músculo esquelético)
- smi (kg/m² índice de massa muscular esquelética)
- protein (kg proteína)
- visceral (grau de gordura visceral, inteiro)
- hydration (% água corporal / hidratação)
- bone (kg massa óssea / sal inorgânico)
- tmb (kcal/dia, inteiro — taxa metabólica basal)
- metabolicAge (anos, inteiro — idade do corpo)
- bodyScore (0-100, inteiro — pontuação corporal)
- targetWeight (kg peso alvo)`;

/**
 * Extrai bioimpedância de IMAGEM (foto do app, print do PDF, etc).
 * Usa Gemini Vision.
 */
export async function extractBodyCompFromImage(base64: string, mimeType: string) {
  const prompt = `Você recebe uma imagem de relatório de balança de bioimpedância (Relaxmedic, Picooc, etc).
Extraia os campos abaixo e responda APENAS com JSON válido, sem \`\`\`json nem comentários nem texto extra.

${BODY_COMP_SCHEMA_PROMPT}`;

  const text = await askGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.1,
    maxOutputTokens: 2048
  }, [{ inlineData: { mimeType, data: base64 } }]);

  return parseJson(text);
}

/**
 * Extrai campos de bioimpedância de um texto bruto (tipicamente de PDF).
 * Retorna JSON estruturado via response schema.
 */
export async function extractBodyCompFromText(rawText: string) {
  const prompt = `Você é um parser de relatórios de balança de bioimpedância (Relaxmedic, Picooc, etc).
Extraia os campos abaixo do texto fornecido. Valores numéricos devem ser números puros (sem unidades).

${BODY_COMP_SCHEMA_PROMPT}

Texto:
"""
${rawText.slice(0, 8000)}
"""

Responda APENAS com JSON válido, sem \`\`\`json nem comentários.`;

  const text = await askGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.1,
    maxOutputTokens: 1024
  });

  return parseJson(text);
}

// ═══ AI COACH ══════════════════════════════════════════════════

export interface WeeklyInsight {
  summary: string;                 // 1-2 frases com tom de coach
  highlights: string[];            // 2-3 pontos positivos
  attentionPoints: string[];       // 1-2 alertas construtivos
  nextWeekFocus: string;           // 1 frase
  plateauDetected?: boolean;
  suggestedDeload?: boolean;
}

export interface CoachContextSession {
  date: string;
  workoutName: string;
  workoutCategory: string;
  totalVolume?: number;
  calories?: number;
  duration?: number;
  prsEarned?: number;
  exerciseCount: number;
}

export interface CoachContext {
  userName: string;
  goals: string[];
  sessions7d: CoachContextSession[];
  sessions28d: { totalSessions: number; avgVolume: number; totalPRs: number };
  latestWeight?: number;
  weightTrend?: 'up' | 'down' | 'stable';
  dietAdherence?: number; // 0-100
}

export async function weeklyCoachInsight(ctx: CoachContext): Promise<WeeklyInsight> {
  const prompt = `Você é um treinador pessoal motivador, mas honesto — responde em PT-BR com tom direto, objetivo e brasileiro.
Analise a semana de treinos desse atleta e gere um feedback curto.

Perfil:
- Nome: ${ctx.userName}
- Objetivos: ${ctx.goals.join(', ') || 'geral'}
- Peso atual: ${ctx.latestWeight ? ctx.latestWeight + 'kg' : 'não informado'}
- Tendência de peso: ${ctx.weightTrend ?? 'estável'}
${ctx.dietAdherence !== undefined ? `- Aderência à dieta: ${ctx.dietAdherence}%` : ''}

Treinos dos últimos 7 dias (${ctx.sessions7d.length} sessões):
${ctx.sessions7d.map((s) =>
  `- ${s.date} · ${s.workoutName} (${s.workoutCategory}) · ${s.exerciseCount} ex · ${s.totalVolume ?? 0}kg volume · ${s.prsEarned ?? 0} PRs`
).join('\n')}

Nos últimos 28 dias: ${ctx.sessions28d.totalSessions} sessões totais, volume médio ${Math.round(ctx.sessions28d.avgVolume)}, ${ctx.sessions28d.totalPRs} PRs.

Gere um JSON com:
- summary: 1-2 frases curtas (máx 160 chars) com tom de coach
- highlights: 2-3 strings curtas com pontos positivos (ex: "3 PRs essa semana", "consistência em dia")
- attentionPoints: 1-2 strings com alertas construtivos (ex: "sem inferior há 6 dias")
- nextWeekFocus: 1 frase objetiva sobre foco da próxima semana
- plateauDetected: true se nenhum PR em 14 dias e volume estagnado
- suggestedDeload: true se treinou 6+ dias seguidos no volume alto

Use "fibra" no copy quando fizer sentido. Seja direto, sem enrolação.`;

  const text = await askGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.5,
    maxOutputTokens: 512
  });

  return parseJson(text);
}

function parseJson(text: string): any {
  // Tenta parse direto
  try { return JSON.parse(text); } catch {}

  // Remove cercas markdown
  const stripped = text.replace(/^```json\n?|\n?```$/g, '').trim();
  try { return JSON.parse(stripped); } catch {}

  // Extrai primeiro bloco { ... } ou [ ... ] válido
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }

  // Tenta completar JSON truncado: fecha strings + objetos abertos
  try { return JSON.parse(repairTruncatedJson(stripped)); } catch {}

  throw new Error(
    `Resposta inválida da IA (JSON malformado). Conteúdo bruto: "${text.slice(0, 160)}..."`
  );
}

/**
 * Reparo de último recurso pra JSON truncado: fecha aspas e brackets abertos.
 */
function repairTruncatedJson(s: string): string {
  let out = s.trim();
  // Remove vírgulas trailing inválidas
  out = out.replace(/,\s*$/, '');
  // Conta { [ " abertos
  let braces = 0, brackets = 0, inString = false, escape = false;
  for (const ch of out) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }
  if (inString) out += '"';
  // Remove qualquer chave parcial no final sem valor (ex: "field":)
  out = out.replace(/,?\s*"[^"]*"\s*:\s*$/, '');
  while (brackets-- > 0) out += ']';
  while (braces-- > 0) out += '}';
  return out;
}

export async function suggestNextLoad(params: {
  exerciseName: string;
  lastSessions: { date: string; topSet: { reps: number; weight: number }; estimated1RM?: number }[];
  goal: 'strength' | 'hypertrophy' | 'endurance';
}): Promise<{ suggestedWeight: number; suggestedReps: number; reasoning: string }> {
  const { exerciseName, lastSessions, goal } = params;
  const prompt = `Você é um treinador de força. Com base no histórico do atleta, sugira carga + reps pra próxima série desse exercício.

Exercício: ${exerciseName}
Objetivo: ${goal === 'strength' ? 'força (3-6 reps)' : goal === 'hypertrophy' ? 'hipertrofia (8-12 reps)' : 'resistência (12-20 reps)'}

Últimas sessões:
${lastSessions.map((s) =>
  `- ${s.date}: top ${s.topSet.weight}kg × ${s.topSet.reps} (1RM ~ ${s.estimated1RM ?? '?'}kg)`
).join('\n')}

Aplique progressão realista (evite saltos > 5% entre sessões). Responda JSON com:
- suggestedWeight (número em kg, múltiplo de 0.5)
- suggestedReps (inteiro)
- reasoning (1 frase curta explicando)`;

  const text = await askGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.3,
    maxOutputTokens: 256
  });

  return parseJson(text);
}

// ═══ AI WORKOUT BUILDER ════════════════════════════════════════

export interface WorkoutBlueprint {
  name: string;
  category: string;
  exercises: {
    exerciseId: string;
    sets: { reps?: number; weight?: number; durationSec?: number; rpeTarget?: number }[];
    restSeconds: number;
    notes?: string;
  }[];
  reasoning: string;
}

export async function buildWorkoutFromPrompt(params: {
  userPrompt: string;
  userProfile: { name: string; goals: string[]; latestWeight?: number; activityLevel?: number };
  catalog: { id: string; name: string; category: string | string[]; muscleGroup: string | string[]; equipment: string }[];
  recentHistory?: { exerciseId: string; lastTopSet?: { weight: number; reps: number } }[];
}): Promise<WorkoutBlueprint> {
  const { userPrompt, userProfile, catalog, recentHistory } = params;
  const history = recentHistory?.filter((h) => h.lastTopSet).slice(0, 20) ?? [];

  const prompt = `Você é um treinador personal brasileiro montando treinos pra o atleta.

Atleta: ${userProfile.name} · objetivos: ${userProfile.goals.join(', ') || 'geral'}${userProfile.latestWeight ? ` · peso ${userProfile.latestWeight}kg` : ''}.

Pedido do atleta: "${userPrompt}"

CATÁLOGO DE EXERCÍCIOS DISPONÍVEIS (use SOMENTE esses IDs, não invente):
${catalog.map((e) => `- ${e.id} | ${e.name} | cat:${Array.isArray(e.category) ? e.category.join(',') : e.category} | muscle:${Array.isArray(e.muscleGroup) ? e.muscleGroup.join(',') : e.muscleGroup} | ${e.equipment}`).join('\n')}

${history.length > 0 ? `Últimas cargas conhecidas do atleta:\n${history.map((h) => `- ${h.exerciseId}: ${h.lastTopSet!.weight}kg × ${h.lastTopSet!.reps}`).join('\n')}\n` : ''}

Monte um treino adequado ao pedido. Regras:
1. Use APENAS exerciseIds do catálogo acima
2. Ordem lógica: composto → isolador → core
3. Para cargas, sugira valores conservadores baseados no histórico (se não houver, deixe weight: 0)
4. 3-4 séries por exercício em geral; core/alongamento pode ser 2-3
5. Descanso: 60s isoladores / 90-120s compostos / 30s alongamento
6. Nome criativo em PT-BR

Responda JSON com:
- name (string)
- category (string — um destes: superior, inferior, fullbody, funcional, crossfit, alongamento, hiit, livre)
- exercises: array de { exerciseId, sets: [{reps, weight, rpeTarget?}], restSeconds, notes? }
- reasoning (1-2 frases em PT-BR explicando a escolha)`;

  const text = await askGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.5,
    maxOutputTokens: 8192
  });

  return parseJson(text);
}

// ═══ AI DIET BUILDER ═══════════════════════════════════════════

export interface DietPlanBlueprint {
  name: string;
  dailyTargets: { kcal: number; proteinG: number; carbG: number; fatG: number; fiberG?: number; waterMl?: number };
  meals: { name: string; time: string; items: { foodId: string; grams: number }[] }[];
  reasoning: string;
}

export async function buildDietFromPrompt(params: {
  userPrompt: string;
  userProfile: { name: string; goals: string[]; weightKg: number; heightCm: number; sex: 'M' | 'F' | 'outro'; activityLevel: number };
  tmb?: number;
  foods: { id: string; name: string; kcalPer100g: number; proteinPer100g: number; carbPer100g: number; fatPer100g: number }[];
}): Promise<DietPlanBlueprint> {
  const { userPrompt, userProfile, tmb, foods } = params;

  const prompt = `Você é um nutricionista brasileiro montando plano alimentar pra o atleta.

Atleta: ${userProfile.name} · ${userProfile.sex === 'F' ? 'F' : 'M'} · ${userProfile.weightKg}kg · ${userProfile.heightCm}cm
Objetivos: ${userProfile.goals.join(', ')}
Nível de atividade: ${userProfile.activityLevel}/5
${tmb ? `TMB: ${tmb} kcal/dia` : ''}

Pedido do atleta: "${userPrompt}"

ALIMENTOS DISPONÍVEIS (use APENAS esses IDs):
${foods.map((f) => `- ${f.id} | ${f.name} | ${f.kcalPer100g}kcal P${f.proteinPer100g} C${f.carbPer100g} G${f.fatPer100g} /100g`).join('\n')}

Monte um plano completo. Regras:
1. Use APENAS foodIds da lista acima
2. 4-6 refeições distribuídas durante o dia com horários realistas PT-BR (café 7h / lanche 10h / almoço 12h30 / lanche 16h / jantar 19h30)
3. Macros devem bater: proteína ≥ 1.8 g/kg (ou 2.4 se cutting), gordura ~25% kcal, carbo resto
4. Kcal total coerente: TMB × atividade + ajuste do objetivo (emagrecer -15%, massa +10%, manter 0)
5. Quantidades em múltiplos de 5g

Responda JSON com:
- name (string, ex: "Plano hipertrofia 2500 kcal")
- dailyTargets: { kcal, proteinG, carbG, fatG, fiberG, waterMl }
- meals: array de { name, time (HH:mm), items: [{foodId, grams}] }
- reasoning (2-3 frases em PT-BR explicando)`;

  const text = await askGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.5,
    maxOutputTokens: 8192
  });

  return parseJson(text);
}

// ═══ AI BODY ANALYZER ══════════════════════════════════════════

export interface BodyAnalyzerResult {
  narrative: string;
  highlights: string[];
  concerns: string[];
  dietAdjustment?: { kcalDelta: number; proteinGDelta?: number; rationale: string };
  trainingAdjustment?: { focus: string; addCardio?: boolean; deloadSuggested?: boolean; rationale: string };
  nextGoal: string;
}

export async function analyzeBodyComposition(params: {
  userProfile: { name: string; goals: string[]; sex: 'M' | 'F' | 'outro'; activityLevel: number };
  current: { date: string; peso?: number; fat?: number; muscle?: number; visceral?: number; waist?: number; hip?: number };
  previous?: { date: string; peso?: number; fat?: number; muscle?: number; visceral?: number; waist?: number; hip?: number };
  weeksBetween: number;
  currentDietKcal?: number;
}): Promise<BodyAnalyzerResult> {
  const { userProfile, current, previous, weeksBetween, currentDietKcal } = params;

  const deltas = previous ? {
    peso: current.peso && previous.peso ? (current.peso - previous.peso).toFixed(1) : null,
    fat: current.fat && previous.fat ? (current.fat - previous.fat).toFixed(1) : null,
    muscle: current.muscle && previous.muscle ? (current.muscle - previous.muscle).toFixed(1) : null,
    visceral: current.visceral && previous.visceral ? current.visceral - previous.visceral : null,
    waist: current.waist && previous.waist ? (current.waist - previous.waist).toFixed(1) : null
  } : null;

  const prompt = `Você é um treinador + nutricionista brasileiro analisando evolução de composição corporal. Fale com tom direto, motivador e honesto.

Atleta: ${userProfile.name} · ${userProfile.sex === 'F' ? 'F' : 'M'}
Objetivos: ${userProfile.goals.join(', ')}
Nível de atividade: ${userProfile.activityLevel}/5
${currentDietKcal ? `Dieta atual: ${currentDietKcal} kcal/dia` : ''}

Avaliação atual (${current.date}):
- Peso: ${current.peso ?? '?'} kg
- % Gordura: ${current.fat ?? '?'}%
- Massa muscular: ${current.muscle ?? '?'} kg
- Gordura visceral: ${current.visceral ?? '?'}
- Cintura: ${current.waist ?? '?'} cm
- Quadril: ${current.hip ?? '?'} cm

${previous && deltas ? `Avaliação anterior (${previous.date}, ${weeksBetween} semanas atrás):
- Peso: ${previous.peso ?? '?'}kg (${deltas.peso ? (Number(deltas.peso) > 0 ? '+' : '') + deltas.peso + 'kg' : '?'})
- % Gordura: ${previous.fat ?? '?'}% (${deltas.fat ? (Number(deltas.fat) > 0 ? '+' : '') + deltas.fat + 'pp' : '?'})
- Massa muscular: ${previous.muscle ?? '?'}kg (${deltas.muscle ? (Number(deltas.muscle) > 0 ? '+' : '') + deltas.muscle + 'kg' : '?'})
- Cintura: ${previous.waist ?? '?'}cm (${deltas.waist ? (Number(deltas.waist) > 0 ? '+' : '') + deltas.waist + 'cm' : '?'})` : 'Esta é a primeira avaliação — sem dados anteriores pra comparar.'}

Analise e sugira ajustes. Use "fibra" no copy quando fizer sentido.

Responda JSON com:
- narrative (2-3 frases resumindo o que mudou e se está no caminho do objetivo)
- highlights: array 2-3 strings positivas
- concerns: array 0-2 strings de alerta (vazio se tudo bem)
- dietAdjustment (opcional, só se faz sentido): { kcalDelta (inteiro +/-), proteinGDelta (opcional), rationale (1 frase) }
- trainingAdjustment (opcional): { focus (1 frase), addCardio (bool), deloadSuggested (bool), rationale (1 frase) }
- nextGoal: 1 frase com meta concreta pras próximas 2-4 semanas`;

  const text = await askGemini(prompt, {
    responseMimeType: 'application/json',
    temperature: 0.5,
    maxOutputTokens: 1024
  });

  return parseJson(text);
}
