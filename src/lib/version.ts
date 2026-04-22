/**
 * Versão "breaking" do app. Bumpa manualmente quando:
 * - Mudou schema de dados (types, migrations)
 * - Retirou feature visível (Apple Watch, semear, etc)
 * - Mudou fluxo crítico (auth, GPS, kcal, etc)
 *
 * O +layout compara com localStorage.fibra_app_version e, se diferente,
 * força signOut pra usuário reautenticar em cima do código novo (sem cache).
 */
export const APP_VERSION = '2.9.6';
export const VERSION_STORAGE_KEY = 'fibra_app_version';
