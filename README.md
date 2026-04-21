# FIBRA

> **O que te constrói.**
> App pessoal de treino, dieta e composição corporal.

Nome com triplo sentido: fibra muscular (treino), fibra alimentar (dieta) e "ter fibra" (grit, consistência).

---

## Stack

- **SvelteKit 2 + Svelte 5** (runes) + TypeScript
- **Firebase**: Auth (Google + e-mail) + Firestore (offline-first nativo)
- **Chart.js 4** para gráficos
- **SortableJS** para drag-and-drop de exercícios
- **PDF.js** + **Gemini API** (tier grátis) para importar avaliação da balança Relax Fit
- **Apple Watch** via app Atalhos do iOS (sem código nativo)

Deploy estático (adapter-static) → Firebase Hosting / Cloudflare Pages / Vercel.

---

## Setup

### 1. Dependências

```bash
cd v2
npm install
```

### 2. Firebase

Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com):

1. **Authentication** → habilitar provedor Google e E-mail/senha
2. **Firestore** → criar banco (modo produção, região `southamerica-east1`)
3. **Project Settings → General → Your apps** → registrar Web app e copiar config

Preencha `.env`:

```bash
cp .env.example .env
# edite .env com suas credenciais
```

### 3. Deploy das regras e índices

```bash
npm i -g firebase-tools
firebase login
firebase use --add   # selecionar o projeto
npm run deploy:rules
```

### 4. Rodar

```bash
npm run dev      # http://localhost:5173
npm run build    # gera /build
npm run preview  # testa o build local
```

---

## Arquitetura de pastas

```
v2/
├─ src/
│  ├─ app.html               shell HTML + fontes + PWA meta
│  ├─ app.css                design tokens + reset
│  ├─ lib/
│  │  ├─ firebase.ts         init com cache persistente
│  │  ├─ types.ts            schema completo do domínio
│  │  ├─ components/         Button, Card, Input, Badge, BottomNav, Header, Stat, Logo
│  │  ├─ stores/
│  │  │  └─ auth.svelte.ts   store reativa do auth (Svelte 5 runes)
│  │  └─ server/
│  │     └─ profile.ts       CRUD do perfil
│  └─ routes/
│     ├─ +layout.svelte      guarda pública/privada
│     ├─ +page.svelte        splash
│     ├─ login/              Google + e-mail
│     ├─ onboarding/         wizard 4 passos
│     └─ (app)/              grupo autenticado
│        ├─ +layout.svelte   Header + BottomNav
│        ├─ home/            dashboard
│        ├─ treinos/         banco de treinos (F2)
│        ├─ registrar/       sessão ativa (F2)
│        ├─ progresso/       stats + AI coach (F5)
│        ├─ corpo/           bioimpedância + PDF Relax Fit (F4)
│        ├─ dieta/           macros + refeições (F3)
│        └─ config-watch/    manual Apple Watch
├─ firebase/
│  ├─ firestore.rules        regras de segurança por uid
│  └─ firestore.indexes.json índices compostos
├─ firebase.json
├─ svelte.config.js
├─ tsconfig.json
└─ vite.config.ts
```

---

## Schema Firestore

```
exerciseCatalog/{id}                     público (read-only)
foodCatalog/{id}                          público (read-only)

users/{uid}                               perfil + settings
  exercises/{id}                          exercícios custom do usuário
  workouts/{id}                           treinos montados
  sessions/{id}                           sessões realizadas
  exerciseLogs/{exId}/entries/{entryId}   histórico por exercício (PRs)
  bodyComp/{date}                         bioimpedância + medidas
  schedule/weekly                         agenda semanal
  dietPlans/{id}                          plano nutricional
  meals/{date}/items/{id}                 log alimentar diário
  foods/{id}                              alimentos favoritos
  watchData/{date}                        dados do Apple Watch
  achievements/{id}                       PRs + streaks + conquistas

publicProfiles/{uid}                      perfil público (opt-in)
```

Todas as coleções protegidas por `request.auth.uid == uid`. Catálogos globais
(exercícios, alimentos) são read-only públicos — seed feito via Admin SDK.

---

## Roadmap

| Fase | Status | Entregas |
|------|--------|----------|
| **F0 — Fundação** | ✅ | Scaffold, Auth, Firestore rules, design system, login, onboarding, shell, manual Apple Watch |
| **F1 — Paridade + Treinos** | ✅ | 41 exercícios seed, CRUD de treinos, editor de séries, registro com timer, PR detection automática, grade semanal, perfil editável |
| **F2 — Treinos 2.0** | ✅ | Histórico por exercício dentro do card (sparkline + último + PR), modal de detalhe completo com charts, drag-n-drop (SortableJS), alongamento/isométrica com cronômetro, CrossFit WOD timer (AMRAP/EMOM/ForTime/RFT/Chipper/Tabata) com round counter |
| **F4 — Corpo + Relax Fit** | ✅ | Formulário completo (básico + bioimpedância + 9 medidas), IMC/BF/WHR classificados automaticamente, importação de PDF da Relax Fit (PDF.js + regex pt-BR) com fallback Gemini, charts de peso/gordura/músculo/medidas, histórico com badge de origem |
| **F3 — Dieta** | ✅ | Plano de macros com sugestão automática (TMB + atividade + objetivos), agenda de refeições template, log diário com anéis estilo Apple Watch, FoodPicker com alimentos brasileiros/custom/Open Food Facts, editor de refeição com múltiplos alimentos |
| **F5 — Social + AI** | ✅ | Dashboard /progresso (stats, streak, heatmap 17 semanas, charts), Gemini Coach com análise semanal cacheada 24h, 4 templates de share card (sessão, PR, streak, semana) via Canvas API 1080×1920, ShareSheet com navigator.share, webhook Apple Watch via Cloud Function |

---

## Integrações

### Apple Watch (via Atalhos)

Ver `/config-watch` no app — manual passo a passo. Resumo:
1. Usuário gera **token pessoal** na tela `/config-watch` (salvo em `users/{uid}/settings.watchToken`)
2. Baixa atalho `.shortcut` hospedado no iCloud e cola o token
3. Atalho lê Health (FC, calorias, minutos, distância) e faz POST na **Cloud Function** `watchWebhook` com header `X-FIBRA-Token`
4. A função valida o token, salva em `users/{uid}/watchData/{date}` **e anexa** à sessão mais recente do dia (merge automático das calorias se vazias)

**Deploy da function:**
```bash
cd v2/firebase/functions
npm install
firebase deploy --only functions
```

O endpoint final fica em `https://us-central1-<projeto>.cloudfunctions.net/watchWebhook`.

### Balança Relax Fit (PDF)

1. Usuário exporta PDF de avaliação no app da balança
2. FIBRA parseia com PDF.js (regex nos labels em PT)
3. Fallback: se regex falhar, manda PDF pro Gemini 2.0 Flash → JSON estruturado
4. Preview + confirmação antes de salvar em `bodyComp/{date}`

### Gemini (AI Coach)

Tier grátis: 15 req/min, 1.5M tokens/dia. Usos implementados:
- **Análise semanal** (1 req/sem cache 24h) — `weeklyCoachInsight()`: lê últimos 7d + 28d e retorna resumo, highlights, alertas, foco próxima semana, detecção de platô/deload
- **Sugestão de carga** (on-demand) — `suggestNextLoad()`: lê histórico do exercício e sugere peso+reps com progressão realista
- **Parse de PDF Relax Fit** (fallback) — `extractBodyCompFromText()`

Cache em `localStorage` por semana (`fibra:coach:v1`) — só chama Gemini quando a semana muda ou o user clica "Atualizar".

---

## Desenvolvimento

### Convenções

- **Fontes:** Plus Jakarta Sans (UI), JetBrains Mono (números/código)
- **Cores:** dark-first, acento `#00e5ff` (ciano), gradientes roxo/brasa para conquistas
- **Copy:** usar "fibra" no vocabulário ("treinou com fibra", "sua fibra semanal")
- **Componentes:** Svelte 5 runes (`$state`, `$derived`, `$props`), sem stores escritos à mão quando a runa resolve
- **Zero comentários em código** salvo se o *porquê* não é óbvio

### Rodando

```bash
npm run dev          # dev server
npm run check        # type-check
npm run build        # build produção
npm run preview      # preview do build
npm run deploy:rules # apenas rules + indexes
npm run deploy       # build + hosting + rules
```

---

## Licença

Projeto pessoal. Todos os direitos reservados.
