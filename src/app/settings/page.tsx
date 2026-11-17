import type { Metadata } from 'next';
import { SCREEN_TITLES } from '@/components/copy/common';
import { SettingsScreen } from '@/components/settings/SettingsScreen';

export const metadata: Metadata = { title: SCREEN_TITLES.settings };

export default function SettingsPage() {
  return <SettingsScreen />;
}
