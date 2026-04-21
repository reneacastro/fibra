import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.svelte';
import { getProfile } from '$lib/db/profile';

export const load = async ({ url }) => {
  if (!browser) return {};
  // Espera o auth estabilizar
  if (authStore.loading) return {};
  if (!authStore.user) throw redirect(302, '/login');

  // Se não tem perfil completo, manda pro onboarding
  const profile = await getProfile(authStore.user.uid);
  if (!profile && url.pathname !== '/onboarding') {
    throw redirect(302, '/onboarding');
  }

  return { profile };
};
