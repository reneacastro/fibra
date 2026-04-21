/**
 * Garante que uma Promise ou resolve dentro do tempo limite,
 * ou rejeita. Usado pra não deixar tela presa em spinner quando
 * Firestore fica esperando sync que não vem.
 */
export function withTimeout<T>(p: Promise<T>, ms = 10_000, label = 'operação'): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} não respondeu em ${ms}ms`)), ms)
    )
  ]);
}
