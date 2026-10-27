import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Modo edición / admin: solo con `?debug=1` en la URL. */
export function useDebugMode(): boolean {
  const [searchParams] = useSearchParams();
  return useMemo(() => {
    if (searchParams.get('debug') === '1') return true;
    if (typeof window !== 'undefined' && window.location.search.includes('debug=1')) {
      return true;
    }
    return false;
  }, [searchParams]);
}
