'use client';

import { PLACEHOLDER, SCREEN_TITLES } from '@/components/copy/common';
import { Screen } from '@/components/shell/Screen';

/** Stub until task 8. */
export function HistoryScreen() {
  return (
    <Screen title={SCREEN_TITLES.history} skeleton={[3, 5, 5, 3, 5]}>
      <p className="text-muted">{PLACEHOLDER.comingSoon}</p>
    </Screen>
  );
}
