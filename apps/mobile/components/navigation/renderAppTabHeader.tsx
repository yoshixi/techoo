import type { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import { getHeaderTitle } from '@react-navigation/elements';
import { AppTabHeader } from '@/components/navigation/AppTabHeader';

export function renderAppTabHeader({ options, route }: BottomTabHeaderProps) {
  const title = getHeaderTitle(options, route.name);
  const showSettings = route.name !== 'settings';
  return <AppTabHeader title={title} showSettings={showSettings} />;
}
