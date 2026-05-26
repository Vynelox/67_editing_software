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

  const push = (snapshot: AppSnapshot) => {
    setUndoStack(s => {
      const next = s.concat([snapshot]);
      if (next.length > MAX) return next.slice(next.length - MAX);
      return next;
    });
    setRedoStack([]);
  };

  const undo = (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const next = prev.slice(0, prev.length - 1);
      // push current to redo
      setRedoStack(r => r.concat([currentSnapshot]));
      // restore last
      restore(last);
      return next;
    });
  };

  const redo = (currentSnapshot: AppSnapshot, restore: (snap: AppSnapshot) => void) => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const next = prev.slice(0, prev.length - 1);
      setUndoStack(u => u.concat([currentSnapshot]));
      restore(last);
      return next;
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
