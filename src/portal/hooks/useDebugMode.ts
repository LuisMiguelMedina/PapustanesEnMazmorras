import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

function readDebugFromSearch(search: string): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).get('debug') === '1';
  } catch {
    return false;
  }
}

/** Modo edición / admin: solo con `?debug=1` en la URL (valor exacto). */
export function useDebugMode(): boolean {
  const [searchParams] = useSearchParams();
  return useMemo(() => {
    if (searchParams.get('debug') === '1') return true;
    if (typeof window !== 'undefined') {
      return readDebugFromSearch(window.location.search);
    }
    return false;
  }, [searchParams]);
}
