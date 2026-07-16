import { localeForHostname } from "./catalog.ts";
import { reduceApp, snapshotForPath, type AppIntent, type AppSnapshot } from "./state.ts";
import { renderApp } from "./view.ts";

export type { AppIntent, AppSnapshot } from "./state.ts";
export type { CharacterId, ExperienceId, Locale } from "./catalog.ts";

export interface BombApp {
  dispatch(intent: AppIntent): void;
  getSnapshot(): AppSnapshot;
  subscribe(listener: (snapshot: AppSnapshot) => void): () => void;
  dispose(): void;
}

export type CreateBombAppOptions = Readonly<{
  hostname: string;
  root: HTMLElement;
  initialPath?: string;
  onPathChange?: (path: string) => void;
}>;

export function createBombApp({
  hostname,
  root,
  initialPath = "/",
  onPathChange,
}: CreateBombAppOptions): BombApp {
  const locale = localeForHostname(hostname);
  let snapshot = snapshotForPath(locale, initialPath);
  let disposed = false;
  let disposeView = (): void => undefined;
  const listeners = new Set<(nextSnapshot: AppSnapshot) => void>();
  let app: BombApp;

  function publish(nextSnapshot: AppSnapshot): void {
    if (nextSnapshot === snapshot) return;
    disposeView();
    const previousPath = snapshot.currentPath;
    snapshot = nextSnapshot;
    disposeView = renderApp(root, snapshot, app.dispatch);
    if (snapshot.currentPath !== previousPath) onPathChange?.(snapshot.currentPath);
    for (const listener of listeners) listener(snapshot);
  }

  app = {
    dispatch(intent) {
      if (disposed) return;
      publish(reduceApp(snapshot, intent));
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeView();
      listeners.clear();
      root.replaceChildren();
    },
  };

  disposeView = renderApp(root, snapshot, app.dispatch);
  return app;
}
