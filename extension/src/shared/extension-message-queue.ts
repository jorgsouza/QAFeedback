/**
 * Serializa chamadas assíncronas ao runtime da extensão na mesma aba,
 * evitindo respostas trocadas quando há muitos `sendMessage` em paralelo (ex.: timeline + captura).
 */
let chain: Promise<unknown> = Promise.resolve();

export function enqueueRuntimeMessage<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(() => fn());
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
