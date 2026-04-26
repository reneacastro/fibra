/**
 * Toast in-app — notificacao transitoria mostrada enquanto o app
 * esta aberto. NAO e push do sistema (pra isso veja stores/push).
 *
 * Uso:
 *   import { toast } from '$lib/stores/toast.svelte';
 *   toast.success('PR no supino!', { icon: '🏆' });
 *   toast.error('Falha ao salvar treino');
 *   toast.info('Mensagem nova de Tassiane', { onClick: () => goto('/chat/...') });
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  icon?: string;
  /** ms ate auto-dismiss (default: 4000). 0 = nao some sozinho */
  duration?: number;
  /** Callback ao tocar no toast */
  onClick?: () => void;
}

class ToastStore {
  list = $state<Toast[]>([]);

  private push(t: Omit<Toast, 'id'>) {
    const id = 't_' + Math.random().toString(36).slice(2, 10);
    const toast: Toast = { id, duration: 4000, ...t };
    this.list = [...this.list, toast];
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }
  }

  success(message: string, opts: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) {
    this.push({ type: 'success', message, icon: opts.icon ?? '✅', ...opts });
  }

  error(message: string, opts: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) {
    this.push({ type: 'error', message, icon: opts.icon ?? '⚠️', duration: 6000, ...opts });
  }

  info(message: string, opts: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) {
    this.push({ type: 'info', message, icon: opts.icon ?? '💬', ...opts });
  }

  warning(message: string, opts: Partial<Omit<Toast, 'id' | 'type' | 'message'>> = {}) {
    this.push({ type: 'warning', message, icon: opts.icon ?? '⚠️', duration: 5000, ...opts });
  }

  dismiss(id: string) {
    this.list = this.list.filter((t) => t.id !== id);
  }

  clearAll() {
    this.list = [];
  }
}

export const toast = new ToastStore();
