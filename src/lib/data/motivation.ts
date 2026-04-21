/**
 * Frases de incentivo exibidas na home a cada entrada no app.
 * Tom FIBRA: direto, brasileiro, sem clichê motivacional-coach.
 * Jogam com o triplo sentido de "fibra" (muscular / alimentar / grit) quando cabe.
 */

export const MOTIVATION_PHRASES: readonly string[] = [
  'Dia de construir fibra.',
  'Uma série de cada vez.',
  'O shape não se faz de achismo — se faz de constância.',
  'A versão sua de daqui a 3 meses começa agora.',
  'Fibra muscular cresce na disciplina, não no fim de semana.',
  'Não precisa ser perfeito. Só precisa começar.',
  'Quem treina hoje não negocia com quem é amanhã.',
  'Progresso mora no tédio do básico bem feito.',
  'A carga sobe, a mente sobe junto.',
  'O treino difícil é o que conta.',
  'Fibra não é talento, é escolha repetida.',
  'Cada rep é um voto em quem você quer ser.',
  'Você contra você mesmo. Sempre.',
  'Descanso bom é descanso merecido.',
  'Consistência bate motivação toda vez.',
  'Hoje é dia de vestir fibra.',
  'Bora? Bora.'
];

export function randomPhrase(): string {
  return MOTIVATION_PHRASES[Math.floor(Math.random() * MOTIVATION_PHRASES.length)];
}
