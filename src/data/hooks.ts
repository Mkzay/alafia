'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { createRepository } from './repositories';
import { DataStore } from './store';
import type { DataSnapshot } from './store';

let store: DataStore | null = null;

/** One store per page. Created on first client use, never during server rendering. */
export function getStore(): DataStore {
  if (!store) {
    const clock = () => Date.now();
    store = new DataStore(() => createRepository(clock), clock);
  }
  return store;
}

/** Tests only. Replaces the shared store. */
export function setStoreForTesting(next: DataStore | null): void {
  store = next;
}

function useSnapshot(): DataSnapshot {
  const s = getStore();
  return useSyncExternalStore(s.subscribe, s.getSnapshot, s.getServerSnapshot);
}

export function useCharacter() {
  const snap = useSnapshot();
  return useMemo(() => ({ state: snap.state, status: snap.status }), [snap.state, snap.status]);
}

export function useHistory() {
  const snap = useSnapshot();
  return useMemo(
    () => ({ logsByDay: snap.logsByDay, status: snap.status }),
    [snap.logsByDay, snap.status],
  );
}

export function useLatestCoachMessage() {
  return useSnapshot().latestCoach;
}

export function useStorageStatus() {
  const snap = useSnapshot();
  return useMemo(
    () => ({ mode: snap.mode, skippedRecords: snap.skippedRecords, status: snap.status }),
    [snap.mode, snap.skippedRecords, snap.status],
  );
}

export function useSettings() {
  const snap = useSnapshot();
  const s = getStore();
  return useMemo(
    () => ({
      settings: snap.settings,
      setAiEnabled: (enabled: boolean) => s.setAiEnabled(enabled),
      acknowledgeFirstRun: () => s.acknowledgeFirstRun(),
    }),
    [snap.settings, s],
  );
}

export function useDataActions() {
  const s = getStore();
  return useMemo(
    () => ({
      addLog: s.addLog.bind(s),
      updateLog: s.updateLog.bind(s),
      deleteLog: s.deleteLog.bind(s),
      saveCoachMessage: s.saveCoachMessage.bind(s),
      trySpendAiCall: s.trySpendAiCall.bind(s),
      exportData: s.exportData.bind(s),
      resetData: s.resetData.bind(s),
    }),
    [s],
  );
}
