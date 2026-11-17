import type { Metadata } from 'next';
import { SCREEN_TITLES } from '@/components/copy/common';
import { HomeScreen } from '@/components/home/HomeScreen';

export const metadata: Metadata = { title: SCREEN_TITLES.home };

export default function HomePage() {
  return <HomeScreen />;
}
