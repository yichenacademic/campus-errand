import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSeedState, STATE_VERSION } from '../data/seed';
import type { AppState, User } from '../types';
import { HOUR } from '../utils/time';
import { reduce, type Action } from './logic';

const STORAGE_KEY = 'shunlu-campus-errand';
/** 广场上的演示任务时间都是相对「现在」生成的，闲置太久会整体过期，此时只刷新广场，不动用户自己的数据 */
const PLAZA_MAX_AGE = 6 * HOUR;

/** 与我有关的任务（我发布的、我接的）永远保留；其余广场任务换成新生成的一批 */
function refreshPlaza(state: AppState): AppState {
  const fresh = createSeedState();
  const mine = state.tasks.filter((t) => t.publisherId === state.meId || t.runnerId === state.meId);
  const keptIds = new Set(mine.map((t) => t.id));
  const plaza = fresh.tasks.filter((t) => !keptIds.has(t.id) && t.publisherId !== fresh.meId && t.runnerId !== fresh.meId);
  return { ...state, tasks: [...mine, ...plaza], savedAt: Date.now() };
}

/** 旧版本数据迁移：v3 的「代取外卖」并入「带饭 / 代买」，状态集合是新版本的子集，可直接沿用 */
function migrate(raw: AppState): AppState | null {
  if (!raw || !Array.isArray(raw.tasks) || !raw.users || !raw.meId) return null;
  if (raw.version === STATE_VERSION) return raw;
  if (raw.version === 3) {
    return {
      ...raw,
      version: STATE_VERSION,
      tasks: raw.tasks.map((t) => ((t.type as string) === 'takeout' ? { ...t, type: 'meal' } : t)),
    };
  }
  return null;
}

function parse(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw) as AppState);
  } catch {
    return null;
  }
}

function loadState(): AppState {
  try {
    const saved = parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return Date.now() - saved.savedAt > PLAZA_MAX_AGE ? refreshPlaza(saved) : saved;
  } catch {
    // 存储不可用时使用初始数据
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
  refresh: () => void;
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

  // 从其他标签页同步过来的数据不再写回，避免两个标签页互相触发
  const skipSave = useRef(false);
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveState(state);
  }, [state]);

  // 多个标签页同时打开时，任一页面的操作会同步到其他页面，保证各处看到的是同一份任务数据
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = parse(e.newValue);
      if (!next) return;
      skipSave.current = true;
      stateRef.current = next;
      setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  const refresh = useCallback(() => {
    const next = refreshPlaza(stateRef.current);
    stateRef.current = next;
    setState(next);
    setNow(Date.now());
    toast('广场已刷新，你的任务和记录都还在', 'info');
  }, [toast]);

  const value = useMemo<Store>(
    () => ({ state, me: state.users[state.meId], now, run, reset, refresh, toast, toasts }),
    [state, now, run, reset, refresh, toast, toasts],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore 必须在 AppStoreProvider 内使用');
  return ctx;
}
