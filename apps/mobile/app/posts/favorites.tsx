import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function PostFavoritesScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace({ pathname: '/logbook', params: { tab: 'favorites' } });
  }, [router]);

  return null;
}
