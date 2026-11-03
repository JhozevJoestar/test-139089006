import { useEffect, useState } from "react";
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(undefined);
    setError("");
    void load()
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [...deps, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
