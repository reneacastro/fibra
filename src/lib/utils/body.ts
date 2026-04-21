export function calcIMC(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export interface IMCCategory {
  label: string;
  range: string;
  color: string;
  tone: 'success' | 'warn' | 'danger' | 'info';
}

export function classifyIMC(imc: number): IMCCategory {
  if (imc < 18.5)       return { label: 'Abaixo do peso', range: '< 18.5',      color: 'var(--info)',    tone: 'info' };
  if (imc < 25)         return { label: 'Normal',         range: '18.5 – 24.9', color: 'var(--success)', tone: 'success' };
  if (imc < 30)         return { label: 'Sobrepeso',      range: '25 – 29.9',   color: 'var(--warn)',    tone: 'warn' };
  if (imc < 35)         return { label: 'Obesidade I',    range: '30 – 34.9',   color: 'var(--warn)',    tone: 'warn' };
  if (imc < 40)         return { label: 'Obesidade II',   range: '35 – 39.9',   color: 'var(--danger)',  tone: 'danger' };
  return                       { label: 'Obesidade III',  range: '≥ 40',        color: 'var(--danger)',  tone: 'danger' };
}

/**
 * TMB por Harris-Benedict revisado (Mifflin-St Jeor)
 * Mais preciso que Harris-Benedict original.
 */
export function calcTMB(weightKg: number, heightCm: number, ageYears: number, sex: 'M' | 'F'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'M' ? base + 5 : base - 161);
}

export function calcAge(birthDate: string): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const mo = today.getMonth() + 1 - m;
  if (mo < 0 || (mo === 0 && today.getDate() < d)) age--;
  return age;
}

/** Ratio cintura/quadril: <0.9 M / <0.85 F = saudável */
export function calcWHR(waist?: number, hip?: number): number | null {
  if (!waist || !hip) return null;
  return Math.round((waist / hip) * 100) / 100;
}

/** % gordura estimada por IMC (quando não tem bioimpedância) */
export function estimateBF(imc: number, age: number, sex: 'M' | 'F'): number {
  // Fórmula de Deurenberg
  const bf = 1.2 * imc + 0.23 * age - 10.8 * (sex === 'M' ? 1 : 0) - 5.4;
  return Math.max(0, Math.round(bf * 10) / 10);
}

/** Classificação saudável de % gordura por sexo e idade (ACSM aproximado) */
export function classifyBF(bf: number, sex: 'M' | 'F'): IMCCategory {
  const ranges = sex === 'M'
    ? [{ max: 5, l: 'Muito baixo', t: 'warn' as const },
       { max: 13, l: 'Atleta', t: 'success' as const },
       { max: 17, l: 'Ótimo', t: 'success' as const },
       { max: 24, l: 'Normal', t: 'info' as const },
       { max: 30, l: 'Sobrepeso', t: 'warn' as const },
       { max: 100, l: 'Obesidade', t: 'danger' as const }]
    : [{ max: 13, l: 'Muito baixo', t: 'warn' as const },
       { max: 20, l: 'Atleta', t: 'success' as const },
       { max: 24, l: 'Ótimo', t: 'success' as const },
       { max: 31, l: 'Normal', t: 'info' as const },
       { max: 37, l: 'Sobrepeso', t: 'warn' as const },
       { max: 100, l: 'Obesidade', t: 'danger' as const }];
  for (const r of ranges) {
    if (bf <= r.max) {
      return {
        label: r.l,
        range: '',
        color: r.t === 'success' ? 'var(--success)' : r.t === 'warn' ? 'var(--warn)' : r.t === 'danger' ? 'var(--danger)' : 'var(--info)',
        tone: r.t
      };
    }
  }
  return { label: 'Obesidade', range: '', color: 'var(--danger)', tone: 'danger' };
}
