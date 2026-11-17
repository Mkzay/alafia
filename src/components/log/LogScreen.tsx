'use client';

import { useRouter } from 'next/navigation';
import { PLACEHOLDER, SCREEN_TITLES } from '@/components/copy/common';
import { LOG_SHEET } from '@/components/copy/log';
import { Screen } from '@/components/shell/Screen';

/** Full-height sheet (U1.3). Forms arrive in task 4. */
export function LogScreen() {
  const router = useRouter();
  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  return (
    <div className="min-h-dvh bg-surface">
      <Screen
        title={SCREEN_TITLES.log}
        skeleton={[3, 6, 6, 4]}
        action={
          <button
            type="button"
            onClick={close}
            className="min-h-11 min-w-11 rounded-md px-3 text-muted hover:text-text"
          >
            {LOG_SHEET.close}
          </button>
        }
      >
        <p className="text-muted">{PLACEHOLDER.comingSoon}</p>
      </Screen>
    </div>
  );
}
