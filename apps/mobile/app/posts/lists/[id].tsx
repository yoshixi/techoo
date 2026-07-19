import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function PostListDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id == null) return;
    router.replace({ pathname: '/logbook', params: { tab: `list:${id}` } });
  }, [id, router]);

  return null;
}
