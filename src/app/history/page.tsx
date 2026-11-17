import type { Metadata } from 'next';
import { SCREEN_TITLES } from '@/components/copy/common';
import { HistoryScreen } from '@/components/history/HistoryScreen';

export const metadata: Metadata = { title: SCREEN_TITLES.history };

export default function HistoryPage() {
  return <HistoryScreen />;
}
