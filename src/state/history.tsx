import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';

export type AppSnapshot = any; // opaque snapshot type (App decides structure)

export type HistoryAction = 'push' | 'undo' | 'redo' | 'clear';

export function logHistoryAction(
  scope: string,
  action: HistoryAction,
  detail?: Record<string, unknown>,
) {
  console.log(`[history:${scope}] ${action}`, {
    ...detail,
    timestamp: new Date().toISOString(),
  });
}

type HistoryStack<T> = {
  push: (snapshot: T) => void;
  undo: (currentSnapshot: T, restore: (snap: T) => void) => void;
  redo: (currentSnapshot: T, restore: (snap: T) => void) => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

function readIncludeResize(): boolean {
  try {
    const v = window.localStorage.getItem('juicecut.settings.includeResizeInUndo');
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

export function useLocalHistory<T>(scope: string, max = 200): HistoryStack<T> {
  const [undoStack, setUndoStack] = useState<T[]>([]);
  const [redoStack, setRedoStack] = useState<T[]>([]);

  const push = useCallback((snapshot: T) => {
    setUndoStack(prev => {
      logHistoryAction(scope, 'push', {
        undoDepthBefore: prev.length,
        undoDepthAfter: Math.min(prev.length + 1, max),
      });
      const next = prev.concat([snapshot]);
      if (next.length > max) return next.slice(next.length - max);
      return next;
    });
    setRedoStack([]);
  }, [scope, max]);

  const undo = useCallback((currentSnapshot: T, restore: (snap: T) => void) => {
    setUndoStack(prev => {
      if (prev.length === 0) {
        logHistoryAction(scope, 'undo', { result: 'noop', reason: 'empty undo stack' });
        return prev;
      }
      const copy = [...prev];
      const toRestore = copy.pop()!;
      logHistoryAction(scope, 'undo', {
        undoDepthAfter: copy.length,
      });
      setRedoStack(r => r.concat([currentSnapshot]));
      restore(toRestore);
      return copy;
    });
  }, [scope]);

  const redo = useCallback((currentSnapshot: T, restore: (snap: T) => void) => {
    setRedoStack(prev => {
      if (prev.length === 0) {
        logHistoryAction(scope, 'redo', { result: 'noop', reason: 'empty redo stack' });
        return prev;
      }
      const copy = [...prev];
      const toRestore = copy.pop()!;
      logHistoryAction(scope, 'redo', {
        redoDepthAfter: copy.length,
      });
      setUndoStack(u => u.concat([currentSnapshot]));
      restore(toRestore);
      return copy;
    });
  }, [scope]);

  const clear = useCallback(() => {
    logHistoryAction(scope, 'clear', {
      undoDepthBefore: undoStack.length,
      redoDepthBefore: redoStack.length,
    });
    setUndoStack([]);
    setRedoStack([]);
  }, [scope, undoStack.length, redoStack.length]);

  return {
    push,
    undo,
    redo,
    clear,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

type HistoryContextType = HistoryStack<AppSnapshot>;

const HistoryContext = createContext<HistoryContextType | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<AppSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<AppSnapshot[]>([]);
  const MAX = 200;
  const scope = 'app';

  const push = (snapshot: AppSnapshot) => {
    setUndoStack(s => {
      logHistoryAction(scope, 'push', {
        undoDepthBefore: s.length,
        undoDepthAfter: Math.min(s.length + 1, MAX),
        meta: snapshot?.__meta,
      });
      const next = s.concat([snapshot]);
      if (next.length > MAX) return next.slice(next.length - MAX);
      return next;
    });
    setRedoStack([]);
  };

  const undo = (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => {
    const includeResize = readIncludeResize();
    setUndoStack(prev => {
      if (prev.length === 0) {
        logHistoryAction(scope, 'undo', { result: 'noop', reason: 'empty undo stack' });
        return prev;
      }
      const copy = [...prev];
      const movedToRedo: AppSnapshot[] = [];
      while (copy.length > 0) {
        const last = copy[copy.length - 1];
        if (!includeResize && last?.__meta?.type === 'resize') {
          movedToRedo.push(copy.pop()!);
          continue;
        }
        const toRestore = copy.pop()!;
        logHistoryAction(scope, 'undo', {
          undoDepthAfter: copy.length,
          skippedResizeSnapshots: movedToRedo.length,
          restoredMeta: toRestore?.__meta,
        });
        setRedoStack(r => r.concat([currentSnapshot]).concat(movedToRedo.reverse()));
        restore(toRestore);
        return copy;
      }
      logHistoryAction(scope, 'undo', { result: 'noop', reason: 'only resize snapshots remaining' });
      return prev;
    });
  };

  const redo = (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => {
    const includeResize = readIncludeResize();
    setRedoStack(prev => {
      if (prev.length === 0) {
        logHistoryAction(scope, 'redo', { result: 'noop', reason: 'empty redo stack' });
        return prev;
      }
      const copy = [...prev];
      const movedToUndo: AppSnapshot[] = [];
      while (copy.length > 0) {
        const last = copy[copy.length - 1];
        if (!includeResize && last?.__meta?.type === 'resize') {
          movedToUndo.push(copy.pop()!);
          continue;
        }
        const toRestore = copy.pop()!;
        logHistoryAction(scope, 'redo', {
          redoDepthAfter: copy.length,
          skippedResizeSnapshots: movedToUndo.length,
          restoredMeta: toRestore?.__meta,
        });
        setUndoStack(u => u.concat([currentSnapshot]).concat(movedToUndo.reverse()));
        restore(toRestore);
        return copy;
      }
      logHistoryAction(scope, 'redo', { result: 'noop', reason: 'only resize snapshots remaining' });
      return prev;
    });
  };

  const clear = () => {
    logHistoryAction(scope, 'clear', {
      undoDepthBefore: undoStack.length,
      redoDepthBefore: redoStack.length,
    });
    setUndoStack([]);
    setRedoStack([]);
  };

  const value: HistoryContextType = {
    push,
    undo,
    redo,
    clear,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used within a HistoryProvider');
  return ctx;
}

export default HistoryProvider;
