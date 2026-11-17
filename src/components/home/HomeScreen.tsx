'use client';

import { PLACEHOLDER, SCREEN_TITLES } from '@/components/copy/common';
import { Screen } from '@/components/shell/Screen';

/** Stub until task 3. */
export function HomeScreen() {
  return (
    <Screen title={SCREEN_TITLES.home} skeleton={[12, 4, 6, 10]}>
      <p className="text-muted">{PLACEHOLDER.comingSoon}</p>
    </Screen>
  );
}
