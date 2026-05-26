import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AppSnapshot = any; // opaque snapshot type (App decides structure)

type HistoryContextType = {
  push: (snapshot: AppSnapshot) => void;
  undo: (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => void;
  redo: (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const HistoryContext = createContext<HistoryContextType | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<AppSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<AppSnapshot[]>([]);
  const MAX = 200;

  const readIncludeResize = () => {
    try {
      const v = window.localStorage.getItem('juicecut.settings.includeResizeInUndo');
      return v === null ? true : v === 'true';
    } catch (err) { return true; }
  };

  const push = (snapshot: AppSnapshot) => {
    setUndoStack(s => {
      const next = s.concat([snapshot]);
      if (next.length > MAX) return next.slice(next.length - MAX);
      return next;
    });
    setRedoStack([]);
  };

  const undo = (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => {
    const includeResize = readIncludeResize();
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      // walk back until we find a snapshot that we should restore
      const copy = [...prev];
      const movedToRedo: AppSnapshot[] = [];
      while (copy.length > 0) {
        const last = copy[copy.length - 1];
        // if we are ignoring resize snapshots for undo and this one is a resize, move it to movedToRedo and continue
        if (!includeResize && last?.__meta?.type === 'resize') {
          movedToRedo.push(copy.pop()!);
          continue;
        }
        // pop this one and restore it
        const toRestore = copy.pop()!;
        setRedoStack(r => r.concat([currentSnapshot]).concat(movedToRedo.reverse()));
        restore(toRestore);
        return copy;
      }
      return prev;
    });
  };

  const redo = (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => {
    const includeResize = readIncludeResize();
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      // walk back (from top of redo stack) until we find an actionable snapshot
      const copy = [...prev];
      const movedToUndo: AppSnapshot[] = [];
      while (copy.length > 0) {
        const last = copy[copy.length - 1];
        if (!includeResize && last?.__meta?.type === 'resize') {
          movedToUndo.push(copy.pop()!);
          continue;
        }
        const toRestore = copy.pop()!;
        setUndoStack(u => u.concat([currentSnapshot]).concat(movedToUndo.reverse()));
        restore(toRestore);
        return copy;
      }
      return prev;
    });
  };

  const clear = () => {
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
