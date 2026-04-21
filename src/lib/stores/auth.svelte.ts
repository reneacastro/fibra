import { browser } from '$app/environment';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type User
} from 'firebase/auth';
import { auth, googleProvider } from '$lib/firebase';

class AuthStore {
  user = $state<User | null>(null);
  loading = $state(true);
  error = $state<string | null>(null);

  constructor() {
    if (browser) {
      onAuthStateChanged(auth(), (u) => {
        this.user = u;
        this.loading = false;
      });
    }
  }

  async signInGoogle() {
    this.error = null;
    try {
      await signInWithPopup(auth(), googleProvider);
    } catch (e) {
      this.error = humanize(e);
      throw e;
    }
  }

  async signInEmail(email: string, password: string) {
    this.error = null;
    try {
      await signInWithEmailAndPassword(auth(), email, password);
    } catch (e) {
      this.error = humanize(e);
      throw e;
    }
  }

  async signUpEmail(email: string, password: string) {
    this.error = null;
    try {
      await createUserWithEmailAndPassword(auth(), email, password);
    } catch (e) {
      this.error = humanize(e);
      throw e;
    }
  }

  async signOut() {
    await fbSignOut(auth());
  }

  get uid() {
    return this.user?.uid ?? null;
  }
}

function humanize(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha inválidos',
    'auth/user-not-found': 'Usuário não encontrado',
    'auth/wrong-password': 'Senha incorreta',
    'auth/email-already-in-use': 'E-mail já cadastrado',
    'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres)',
    'auth/popup-closed-by-user': 'Login cancelado',
    'auth/network-request-failed': 'Sem conexão'
  };
  return map[code] ?? 'Ocorreu um erro. Tente novamente.';
}

export const authStore = new AuthStore();
