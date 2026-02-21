import { useEffect, useState } from 'react';
import { View } from 'react-native';

export interface CurrentTimeIndicatorProps {
  hourHeight: number;
  offsetLeft: number;
}

export function CurrentTimeIndicator({ hourHeight, offsetLeft }: CurrentTimeIndicatorProps) {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      setPosition((minutes / 60) * hourHeight);
    };

    updatePosition();
    const interval = setInterval(updatePosition, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [hourHeight]);

  return (
    <View
      style={{
        position: 'absolute',
        top: position,
        left: offsetLeft,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
      }}
      pointerEvents="none"
    >
      <View className="h-2 w-2 rounded-full bg-red-500" />
      <View className="flex-1 h-[1px] bg-red-500" />
    </View>
  );
}
