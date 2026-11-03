type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeJournal(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitJournal(): void {
  for (const listener of listeners) listener();
}
