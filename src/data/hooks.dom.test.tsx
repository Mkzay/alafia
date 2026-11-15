// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setStoreForTesting, useCharacter, useDataActions, useHistory, useStorageStatus } from './hooks';
import { MemoryRepository } from './memory-repository';
import { DataStore } from './store';

let store: DataStore;
let actions: ReturnType<typeof useDataActions>;

function Probe() {
  const dataActions = useDataActions();
  useEffect(() => {
    actions = dataActions;
  }, [dataActions]);
  const { state, status } = useCharacter();
  const { logsByDay } = useHistory();
  const { mode, skippedRecords } = useStorageStatus();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="xp">{state.totalXp}</p>
      <p data-testid="logs">{logsByDay.reduce((n, d) => n + d.logs.length, 0)}</p>
      <p data-testid="mode">{`${mode}:${skippedRecords}`}</p>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  const now = new Date(2026, 10, 14, 9, 30).getTime();
  const repo = new MemoryRepository(() => now);
  store = new DataStore(async () => repo, () => now, { rollover: false });
  setStoreForTesting(store);
});

afterEach(async () => {
  cleanup();
  await store.dispose();
  setStoreForTesting(null);
});

describe('data hooks', () => {
  it('render loading, then ready', async () => {
    render(<Probe />);
    expect(text('status')).toBe('loading');
    await act(async () => {
      await store.start();
    });
    expect(text('status')).toBe('ready');
    expect(text('xp')).toBe('0');
    expect(text('mode')).toBe('memory:0');
  });

  it('re-render after add, edit and delete without a reload', async () => {
    render(<Probe />);
    await act(async () => {
      await store.start();
    });

    let id = '';
    await act(async () => {
      const result = await actions.addLog({ type: 'move', kind: 'cardio', minutes: 30, intensity: 'moderate' });
      id = result.log.id;
    });
    expect(text('logs')).toBe('1');
    const afterAdd = Number(text('xp'));
    expect(afterAdd).toBeGreaterThanOrEqual(45);

    await act(async () => {
      await actions.updateLog(id, { type: 'move', minutes: 60 });
    });
    expect(Number(text('xp'))).toBeGreaterThan(afterAdd);

    await act(async () => {
      await actions.deleteLog(id);
    });
    expect(text('logs')).toBe('0');
    expect(text('xp')).toBe('0');
  });

  it('show the empty state again after reset', async () => {
    render(<Probe />);
    await act(async () => {
      await store.start();
      await actions.addLog({ type: 'rest', hours: 8, quality: 3 });
    });
    expect(text('logs')).toBe('1');
    await act(async () => {
      await actions.resetData();
    });
    expect(text('logs')).toBe('0');
    expect(text('xp')).toBe('0');
  });
});
