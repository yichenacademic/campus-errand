import { SIMULATED_RUNNERS } from '../data/seed';
import type { AppState, Rating, Task, TaskStatus, TaskType, TimelineEvent } from '../types';

/* ---------------- 派生状态 ---------------- */

export type DisplayStatus = TaskStatus | 'expired';
export type Role = 'publisher' | 'runner' | 'visitor';

export function isExpired(task: Task, now = Date.now()) {
  return task.status === 'open' && task.deadline <= now;
}

export function displayStatus(task: Task, now = Date.now()): DisplayStatus {
  return isExpired(task, now) ? 'expired' : task.status;
}

export function roleOf(task: Task, meId: string): Role {
  if (task.publisherId === meId) return 'publisher';
  if (task.runnerId === meId) return 'runner';
  return 'visitor';
}

export const STATUS_META: Record<DisplayStatus, { label: string; tone: 'green' | 'blue' | 'orange' | 'gray' | 'red' }> = {
  open: { label: '待接单', tone: 'green' },
  accepted: { label: '进行中', tone: 'blue' },
  delivered: { label: '待确认', tone: 'orange' },
  completed: { label: '已完成', tone: 'gray' },
  cancelled: { label: '已取消', tone: 'gray' },
  expired: { label: '已过期', tone: 'red' },
};

/** 当前用户在这条任务上「接下来要做什么」，用于我的任务列表的提示 */
export function nextStepFor(task: Task, meId: string, now = Date.now()): { text: string; urgent: boolean } | null {
  const role = roleOf(task, meId);
  const s = displayStatus(task, now);
  if (role === 'publisher') {
    if (s === 'open') return { text: '等待同学接单', urgent: false };
    if (s === 'accepted') return { text: '跑腿同学正在路上', urgent: false };
    if (s === 'delivered') return { text: '对方已送达，请确认完成', urgent: true };
    if (s === 'completed' && !task.ratingByPublisher) return { text: '去评价跑腿同学', urgent: true };
    if (s === 'expired') return { text: '无人接单，已过期', urgent: false };
  }
  if (role === 'runner') {
    if (s === 'accepted') return { text: '送达后记得点「我已送达」', urgent: true };
    if (s === 'delivered') return { text: '等待发布者确认', urgent: false };
    if (s === 'completed' && !task.ratingByRunner) return { text: '去评价发布者', urgent: true };
  }
  return null;
}

/* ---------------- 状态流转（纯函数） ---------------- */

export interface PublishDraft {
  type: TaskType;
  title: string;
  description: string;
  privateNote: string;
  from: string;
  to: string;
  reward: number;
  etaMinutes: number;
  deadline: number;
  tags: string[];
}

export type Action =
  | { type: 'publish'; draft: PublishDraft; id: string }
  | { type: 'accept'; taskId: string }
  | { type: 'deliver'; taskId: string }
  | { type: 'confirm'; taskId: string }
  | { type: 'cancel'; taskId: string }
  | { type: 'rate'; taskId: string; rating: Omit<Rating, 'at'> }
  | { type: 'simAccept'; taskId: string }
  | { type: 'simDeliver'; taskId: string }
  | { type: 'simConfirm'; taskId: string };

export type Result = { ok: true; state: AppState; message?: string } | { ok: false; error: string };

const clampCredit = (n: number) => Math.max(0, Math.min(100, n));

let seq = 0;
const logId = () => `c_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function updateTask(state: AppState, taskId: string, patch: (t: Task) => Task): AppState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? patch(t) : t)) };
}

function withEvent(t: Task, e: TimelineEvent): TimelineEvent[] {
  return [...t.timeline, e];
}

function addCredit(state: AppState, delta: number, reason: string, now: number): AppState {
  const me = state.users[state.meId];
  return {
    ...state,
    users: { ...state.users, [me.id]: { ...me, credit: clampCredit(me.credit + delta) } },
    creditLogs: [{ id: logId(), delta, reason, at: now }, ...state.creditLogs],
  };
}

function bumpUser(state: AppState, userId: string, patch: Partial<Record<'runCount' | 'publishCount', 1>>): AppState {
  const user = state.users[userId];
  if (!user) return state;
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: {
        ...user,
        runCount: user.runCount + (patch.runCount ?? 0),
        publishCount: user.publishCount + (patch.publishCount ?? 0),
      },
    },
  };
}

export function reduce(state: AppState, action: Action, now = Date.now()): Result {
  const me = state.users[state.meId];

  if (action.type === 'publish') {
    const d = action.draft;
    const task: Task = {
      id: action.id,
      ...d,
      createdAt: now,
      publisherId: me.id,
      runnerId: null,
      status: 'open',
      timeline: [{ kind: 'published', at: now, text: `${me.name}发布了任务` }],
      ratingByPublisher: null,
      ratingByRunner: null,
    };
    const next = bumpUser({ ...state, tasks: [task, ...state.tasks] }, me.id, { publishCount: 1 });
    return { ok: true, state: next, message: '发布成功，附近同学很快就能看到' };
  }

  const task = state.tasks.find((t) => t.id === action.taskId);
  if (!task) return { ok: false, error: '任务不存在或已被删除' };
  const role = roleOf(task, me.id);
  const expired = isExpired(task, now);

  switch (action.type) {
    case 'accept': {
      if (role === 'publisher') return { ok: false, error: '不能接自己发布的任务哦' };
      if (task.status !== 'open') return { ok: false, error: '手慢了，这个任务已经被其他同学接走' };
      if (expired) return { ok: false, error: '任务已过截止时间，无法接单' };
      const next = updateTask(state, task.id, (t) => ({
        ...t,
        status: 'accepted',
        runnerId: me.id,
        timeline: withEvent(t, { kind: 'accepted', at: now, text: '你接下了任务' }),
      }));
      return { ok: true, state: next, message: '接单成功，记得在截止时间前送达' };
    }

    case 'deliver': {
      if (role !== 'runner') return { ok: false, error: '只有接单同学可以标记送达' };
      if (task.status !== 'accepted') return { ok: false, error: '当前状态无法标记送达' };
      const next = updateTask(state, task.id, (t) => ({
        ...t,
        status: 'delivered',
        timeline: withEvent(t, { kind: 'delivered', at: now, text: '你已送达，等待发布者确认' }),
      }));
      return { ok: true, state: next, message: '已通知发布者确认' };
    }

    case 'confirm': {
      if (role !== 'publisher') return { ok: false, error: '只有发布者可以确认完成' };
      if (task.status !== 'delivered') return { ok: false, error: '对方还未送达，暂时不能确认' };
      let next = updateTask(state, task.id, (t) => ({
        ...t,
        status: 'completed',
        timeline: withEvent(t, { kind: 'completed', at: now, text: `你确认完成，报酬 ¥${t.reward} 已结算` }),
      }));
      if (task.runnerId) next = bumpUser(next, task.runnerId, { runCount: 1 });
      return { ok: true, state: next, message: '任务已完成，给跑腿同学一个评价吧' };
    }

    case 'cancel': {
      if (role !== 'publisher') return { ok: false, error: '只有发布者可以取消任务' };
      if (task.status !== 'open') return { ok: false, error: '已有同学接单，请先与对方沟通' };
      const next = updateTask(state, task.id, (t) => ({
        ...t,
        status: 'cancelled',
        timeline: withEvent(t, { kind: 'cancelled', at: now, text: '你取消了任务' }),
      }));
      return { ok: true, state: next, message: '任务已取消，未被接单时取消不影响信用' };
    }

    case 'rate': {
      if (task.status !== 'completed') return { ok: false, error: '任务完成后才能评价' };
      if (role === 'visitor') return { ok: false, error: '只有任务双方可以评价' };
      const field = role === 'publisher' ? 'ratingByPublisher' : 'ratingByRunner';
      if (task[field]) return { ok: false, error: '你已经评价过了' };
      const target = state.users[(role === 'publisher' ? task.runnerId : task.publisherId) ?? ''];
      const next = updateTask(state, task.id, (t) => ({
        ...t,
        [field]: { ...action.rating, at: now },
        timeline: withEvent(t, { kind: 'rated', at: now, text: `你评价了${target?.name ?? '对方'}` }),
      }));
      return { ok: true, state: next, message: '评价成功，感谢你让校园更有温度' };
    }

    /* ---- 演示：模拟另一方的操作 ---- */

    case 'simAccept': {
      if (role !== 'publisher' || task.status !== 'open') return { ok: false, error: '当前状态无法模拟接单' };
      if (expired) return { ok: false, error: '任务已过期' };
      const runnerId = SIMULATED_RUNNERS[Math.floor(Math.random() * SIMULATED_RUNNERS.length)];
      const runner = state.users[runnerId];
      const next = updateTask(state, task.id, (t) => ({
        ...t,
        status: 'accepted',
        runnerId,
        timeline: withEvent(t, { kind: 'accepted', at: now, text: `${runner.name}接下了任务，正在前往${t.from}` }),
      }));
      return { ok: true, state: next, message: `${runner.name}接下了你的任务` };
    }

    case 'simDeliver': {
      if (role !== 'publisher' || task.status !== 'accepted') return { ok: false, error: '当前状态无法模拟送达' };
      const runner = state.users[task.runnerId ?? ''];
      const next = updateTask(state, task.id, (t) => ({
        ...t,
        status: 'delivered',
        timeline: withEvent(t, { kind: 'delivered', at: now, text: `${runner?.name ?? '跑腿同学'}已送达，等待你确认完成` }),
      }));
      return { ok: true, state: next, message: `${runner?.name ?? '跑腿同学'}已送达，请确认` };
    }

    case 'simConfirm': {
      if (role !== 'runner' || task.status !== 'delivered') return { ok: false, error: '当前状态无法模拟确认' };
      const publisher = state.users[task.publisherId];
      const deliveredAt = [...task.timeline].reverse().find((e) => e.kind === 'delivered')?.at ?? now;
      const onTime = deliveredAt <= task.deadline;
      let next = updateTask(state, task.id, (t) => ({
        ...t,
        status: 'completed',
        timeline: withEvent(t, { kind: 'completed', at: now, text: `${publisher.name}确认完成，报酬 ¥${t.reward} 已结算` }),
        ratingByPublisher: onTime
          ? { score: 5, tags: ['准时送达', '沟通顺畅'], comment: '很靠谱，谢谢同学！', at: now }
          : { score: 4, tags: ['物品完好'], comment: '稍微晚了一点，不过还是谢谢～', at: now },
      }));
      next = bumpUser(next, me.id, { runCount: 1 });
      next = onTime
        ? addCredit(next, 1, `按时完成跑腿「${task.title}」`, now)
        : addCredit(next, -2, `跑腿超时送达「${task.title}」`, now);
      if (onTime) next = addCredit(next, 1, '收到五星好评', now);
      return {
        ok: true,
        state: next,
        message: onTime ? `${publisher.name}确认完成，信用分 +2` : `${publisher.name}确认完成，超时送达信用分 -2`,
      };
    }
  }
}
