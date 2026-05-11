"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UndoEntry<T> = {
  key: string;
  snapshot: T;
};

export function useUndoHistory<T>({
  limit = 40,
  debounceMs = 220,
  serialize
}: {
  limit?: number;
  debounceMs?: number;
  serialize?: (snapshot: T) => string;
}) {
  const serializer = serialize || JSON.stringify;
  const historyRef = useRef<UndoEntry<T>[]>([]);
  const currentRef = useRef<UndoEntry<T> | null>(null);
  const pendingRef = useRef<UndoEntry<T> | null>(null);
  const timerRef = useRef<number | null>(null);
  const [, setVersion] = useState(0);

  const bump = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  const clearTimer = useCallback(() => {
    if (typeof window !== "undefined" && timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const commitPending = useCallback(() => {
    const pending = pendingRef.current;
    const current = currentRef.current;
    if (!pending || !current) {
      pendingRef.current = null;
      clearTimer();
      return;
    }

    historyRef.current = [...historyRef.current, current].slice(-limit);
    currentRef.current = pending;
    pendingRef.current = null;
    clearTimer();
    bump();
  }, [bump, clearTimer, limit]);

  const reset = useCallback(
    (snapshot: T) => {
      const nextEntry = {
        key: serializer(snapshot),
        snapshot
      };

      clearTimer();
      historyRef.current = [];
      currentRef.current = nextEntry;
      pendingRef.current = null;
      bump();
    },
    [bump, clearTimer, serializer]
  );

  const record = useCallback(
    (snapshot: T, options?: { immediate?: boolean }) => {
      const nextEntry = {
        key: serializer(snapshot),
        snapshot
      };

      if (!currentRef.current) {
        currentRef.current = nextEntry;
        bump();
        return;
      }

      const current = currentRef.current;
      if (current.key === nextEntry.key) {
        if (pendingRef.current) {
          pendingRef.current = null;
          clearTimer();
          bump();
        }
        return;
      }

      if (options?.immediate) {
        historyRef.current = [...historyRef.current, current].slice(-limit);
        currentRef.current = nextEntry;
        pendingRef.current = null;
        clearTimer();
        bump();
        return;
      }

      const shouldBump = pendingRef.current === null;
      pendingRef.current = nextEntry;
      clearTimer();

      if (typeof window !== "undefined") {
        timerRef.current = window.setTimeout(() => {
          commitPending();
        }, debounceMs);
      }

      if (shouldBump) {
        bump();
      }
    },
    [bump, clearTimer, commitPending, debounceMs, limit, serializer]
  );

  const undo = useCallback(() => {
    if (pendingRef.current && currentRef.current) {
      pendingRef.current = null;
      clearTimer();
      bump();
      return currentRef.current.snapshot;
    }

    const previous = historyRef.current[historyRef.current.length - 1];
    if (!previous) {
      return null;
    }

    historyRef.current = historyRef.current.slice(0, -1);
    currentRef.current = previous;
    pendingRef.current = null;
    clearTimer();
    bump();
    return previous.snapshot;
  }, [bump, clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);
  return {
    canUndo: Boolean(pendingRef.current) || historyRef.current.length > 0,
    undoCount: historyRef.current.length + (pendingRef.current ? 1 : 0),
    reset,
    record,
    undo
  };
}
