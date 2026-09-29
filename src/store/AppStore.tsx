import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSeedState, STATE_VERSION } from '../data/seed';
import type { AppState, User } from '../types';
import { HOUR } from '../utils/time';
import { reduce, type Action } from './logic';

const STORAGE_KEY = 'shunlu-campus-errand';
/** 演示数据的时间都是相对「现在」生成的，放太久会整体过期，超过这个时长就重新生成 */
const MAX_AGE = 6 * HOUR;

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === STATE_VERSION && Date.now() - parsed.savedAt < MAX_AGE && Array.isArray(parsed.tasks)) {
        return parsed;
      }
    }
  } catch {
    // 存储不可用或数据损坏时直接回到初始数据
  }
  return createSeedState();
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // 隐私模式等场景下写入失败不影响使用
  }
}

export interface ToastItem {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface Store {
  state: AppState;
  me: User;
  /** 每 30 秒刷新一次，驱动倒计时、过期判断 */
  now: number;
  run: (action: Action) => boolean;
  reset: () => void;
  toast: (text: string, tone?: ToastItem['tone']) => void;
  toasts: ToastItem[];
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const stateRef = useRef(state);
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeq = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const toast = useCallback((text: string, tone: ToastItem['tone'] = 'success') => {
    const id = ++toastSeq.current;
    // 同一时间只保留一条提示，避免堆叠遮挡
    setToasts([{ id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2400);
  }, []);

  // 同步地基于最新状态计算，连点两次按钮时第二次会因状态已变化而被拦截
  const run = useCallback(
    (action: Action) => {
      const result = reduce(stateRef.current, action, Date.now());
      if (!result.ok) {
        toast(result.error, 'error');
        return false;
      }
      stateRef.current = result.state;
      setState(result.state);
      setNow(Date.now());
      if (result.message) toast(result.message, 'success');
      return true;
    },
    [toast],
  );

  const reset = useCallback(() => {
    const fresh = createSeedState();
    stateRef.current = fresh;
    setState(fresh);
    setNow(Date.now());
    toast('演示数据已重置', 'info');
  }, [toast]);

  const value = useMemo<Store>(
    () => ({ state, me: state.users[state.meId], now, run, reset, toast, toasts }),
    [state, now, run, reset, toast, toasts],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore 必须在 AppStoreProvider 内使用');
  return ctx;
}
