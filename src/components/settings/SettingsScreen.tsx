'use client';

import { PLACEHOLDER, SCREEN_TITLES } from '@/components/copy/common';
import { Screen } from '@/components/shell/Screen';

/** Stub until task 9. */
export function SettingsScreen() {
  return (
    <Screen title={SCREEN_TITLES.settings} skeleton={[4, 4, 4, 8]}>
      <p className="text-muted">{PLACEHOLDER.comingSoon}</p>
    </Screen>
  );
}
