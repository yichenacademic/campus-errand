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
  const keep = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([id]) => keptIds.has(id)));
  return { ...state, tasks: [...mine, ...plaza], messages: keep(state.messages), reports: keep(state.reports), savedAt: Date.now() };
}

/**
 * 旧版本数据迁移：保留用户的任务数据。
 * - v3 的「代取外卖」并入「带饭 / 代买」
 * - v5 起新增聊天、举报与新版信用体系：个人资料、信用记录换成新版初始数据，
 *   预置聊天只补给状态与初始数据一致的任务，避免聊天内容与进度对不上
 */
function migrate(raw: AppState): AppState | null {
  if (!raw || !Array.isArray(raw.tasks) || !raw.users || !raw.meId) return null;
  if (raw.version === STATE_VERSION) return raw;
  if (raw.version !== 3 && raw.version !== 4) return null;
  const fresh = createSeedState();
  const tasks = raw.tasks.map((t) => ((t.type as string) === 'takeout' ? { ...t, type: 'meal' as const } : t));
  // 预置聊天按旧任务的发布时间平移，保证与旧时间线的先后顺序一致
  const messages = Object.fromEntries(
    Object.entries(fresh.messages).flatMap(([id, list]) => {
      const old = tasks.find((t) => t.id === id);
      const seeded = fresh.tasks.find((t) => t.id === id);
      if (!old || !seeded || old.status !== seeded.status) return [];
      const shift = old.createdAt - seeded.createdAt;
      return [[id, list.map((m) => ({ ...m, at: m.at + shift }))]];
    }),
  );
  return {
    ...raw,
    version: STATE_VERSION,
    tasks,
    users: fresh.users,
    creditLogs: fresh.creditLogs,
    pastReviews: fresh.pastReviews,
    messages,
    reports: {},
  };
}

/**
 * 补上旧数据里没有的预置「我的任务」（如后续版本新增的 m7、m8），保证演示路线里的链接都能打开。
 * 预置任务不会被任何操作删除，所以这一步是幂等的。
 */
function ensureSeedTasks(state: AppState): AppState {
  const existing = new Set(state.tasks.map((t) => t.id));
  const fresh = createSeedState();
  const missing = fresh.tasks.filter((t) => !existing.has(t.id) && (t.publisherId === fresh.meId || t.runnerId === fresh.meId));
  if (missing.length === 0) return state;
  const messages = { ...state.messages };
  for (const t of missing) if (fresh.messages[t.id] && !messages[t.id]) messages[t.id] = fresh.messages[t.id];
  return { ...state, tasks: [...missing, ...state.tasks], messages };
}

function parse(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const state = migrate(JSON.parse(raw) as AppState);
    return state && ensureSeedTasks(state);
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
