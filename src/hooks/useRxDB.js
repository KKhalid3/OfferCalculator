import { useEffect, useState } from 'react';

export function useRxDB(observableFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const subscription = observableFn().subscribe({
      next: (result) => {
        setData(result);
        setLoading(false);
      },
      error: (err) => {
        setError(err);
        setLoading(false);
        console.error('RxDB Observable error:', err);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, deps);

  return { data, loading, error };
}

