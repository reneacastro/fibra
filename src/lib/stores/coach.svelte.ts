import { browser } from '$app/environment';
import { weeklyCoachInsight, type CoachContext, type WeeklyInsight } from '$lib/db/gemini';

const CACHE_KEY = 'fibra:coach:v1';
const TTL = 1000 * 60 * 60 * 24; // 24h

interface Cached {
  uid: string;
  weekStart: string; // ISO YYYY-MM-DD
  insight: WeeklyInsight;
  cachedAt: number;
}

function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=dom
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

class CoachStore {
  insight = $state<WeeklyInsight | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);

  load(uid: string) {
    if (!browser) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw) as Cached;
      if (cached.uid !== uid) return;
      if (cached.weekStart !== weekStartISO()) return;
      if (Date.now() - cached.cachedAt > TTL) return;
      this.insight = cached.insight;
    } catch {}
  }

  async refresh(uid: string, ctx: CoachContext, force = false) {
    if (this.loading) return;
    if (!force && this.insight) return;
    this.loading = true;
    this.error = null;
    try {
      const insight = await weeklyCoachInsight(ctx);
      this.insight = insight;
      if (browser) {
        const cached: Cached = {
          uid,
          weekStart: weekStartISO(),
          insight,
          cachedAt: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      }
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  clear() {
    this.insight = null;
    if (browser) localStorage.removeItem(CACHE_KEY);
  }
}

export const coachStore = new CoachStore();
