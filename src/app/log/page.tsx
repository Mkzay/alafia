import type { Metadata } from 'next';
import { SCREEN_TITLES } from '@/components/copy/common';
import { LogScreen } from '@/components/log/LogScreen';

export const metadata: Metadata = { title: SCREEN_TITLES.log };

export default function LogPage() {
  return <LogScreen />;
}
