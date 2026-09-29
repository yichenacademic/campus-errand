import { useEffect, useState } from 'react';

/** 页面切换后保留筛选条件（如从详情返回广场），存在 sessionStorage，失败时退化为普通 state */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 忽略
    }
  }, [key, value]);

  return [value, setValue] as const;
}
