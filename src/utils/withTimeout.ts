/** Races a promise against a timeout so a slow/unreachable backend (e.g.
 * Firestore rules not configured yet) can never hang a UI action forever. */
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("A operação demorou demais e foi cancelada.")), ms);
    }),
  ]);
}
