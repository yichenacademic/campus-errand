import { SIMULATED_RUNNERS } from '../data/seed';
import type { AppState, ChatMessage, CreditKind, Rating, Task, TaskStatus, TaskType, TimelineEvent } from '../types';
import { DAY } from '../utils/time';

/* ---------------- 派生状态 ---------------- */

export type DisplayStatus = TaskStatus | 'expired';
export type Role = 'publisher' | 'runner' | 'visitor';
type Tone = 'green' | 'blue' | 'orange' | 'gray' | 'red';

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

/** 已接单、跑腿中的各个阶段都算「进行中」 */
export const ACTIVE_STATUSES: TaskStatus[] = ['accepted', 'started', 'picked', 'delivered'];
export const isActive = (t: Task) => ACTIVE_STATUSES.includes(t.status);

export const STATUS_META: Record<DisplayStatus, { label: string; tone: Tone }> = {
  open: { label: '待接单', tone: 'green' },
  accepted: { label: '已接单', tone: 'blue' },
  started: { label: '进行中', tone: 'blue' },
  picked: { label: '已取到', tone: 'blue' },
  delivered: { label: '已送达', tone: 'orange' },
  completed: { label: '已完成', tone: 'gray' },
  cancelled: { label: '已取消', tone: 'gray' },
  expired: { label: '已过期', tone: 'red' },
};

/** 跑腿同学的操作顺序：每个状态下「下一步」按钮 */
export const RUNNER_NEXT: Partial<Record<TaskStatus, { action: 'start' | 'pick' | 'deliver' | 'complete'; label: string }>> = {
  accepted: { action: 'start', label: '开始任务' },
  started: { action: 'pick', label: '已取到物品' },
  picked: { action: 'deliver', label: '已送达' },
  delivered: { action: 'complete', label: '完成任务' },
};

/** 当前用户在这条任务上「接下来要做什么」，用于我的任务列表的提示 */
export function nextStepFor(task: Task, meId: string, now = Date.now()): { text: string; urgent: boolean } | null {
  const role = roleOf(task, meId);
  const s = displayStatus(task, now);
  if (role === 'publisher') {
    if (s === 'open') return { text: '等待同学接单', urgent: false };
    if (s === 'accepted') return { text: '对方已接单，即将出发', urgent: false };
    if (s === 'started') return { text: '对方正在前往取件', urgent: false };
    if (s === 'picked') return { text: '已取到，正在送来', urgent: false };
    if (s === 'delivered') return { text: '已送达，请确认收到', urgent: true };
    if (s === 'completed' && !task.ratingByPublisher) return { text: '去评价跑腿同学', urgent: true };
    if (s === 'expired') return { text: '无人接单，已过期', urgent: false };
  }
  if (role === 'runner') {
    if (s === 'accepted') return { text: '出发时点「开始任务」', urgent: true };
    if (s === 'started') return { text: '取到后更新状态', urgent: true };
    if (s === 'picked') return { text: '送达后更新状态', urgent: true };
    if (s === 'delivered') return { text: '确认对方收到后完成任务', urgent: true };
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
  | { type: 'start'; taskId: string }
  | { type: 'pick'; taskId: string }
  | { type: 'deliver'; taskId: string }
  | { type: 'complete'; taskId: string }
  | { type: 'confirm'; taskId: string }
  | { type: 'cancel'; taskId: string }
  | { type: 'rate'; taskId: string; rating: Omit<Rating, 'at'> }
  | { type: 'abandon'; taskId: string }
  | { type: 'sendMessage'; taskId: string; id: string; text: string }
  | { type: 'receiveMessage'; taskId: string; id: string; text: string }
  | { type: 'report'; taskId: string; reason: string; detail: string }
  | { type: 'simAccept'; taskId: string }
  | { type: 'simAdvance'; taskId: string }
  | { type: 'simRate'; taskId: string };

export type Result = { ok: true; state: AppState; message?: string } | { ok: false; error: string };

const clampCredit = (n: number) => Math.max(0, Math.min(100, n));

let seq = 0;
const logId = () => `c_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function updateTask(state: AppState, taskId: string, patch: (t: Task) => Task): AppState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? patch(t) : t)) };
}

function transition(state: AppState, taskId: string, status: TaskStatus, event: TimelineEvent, extra: Partial<Task> = {}): AppState {
  return updateTask(state, taskId, (t) => ({ ...t, ...extra, status, timeline: [...t.timeline, event] }));
}

function addCredit(state: AppState, delta: number, reason: string, now: number, kind?: CreditKind, taskId?: string): AppState {
  const me = state.users[state.meId];
  return {
    ...state,
    users: { ...state.users, [me.id]: { ...me, credit: clampCredit(me.credit + delta) } },
    creditLogs: [{ id: logId(), delta, reason, at: now, kind, taskId }, ...state.creditLogs],
  };
}

/** 本次任务给我带来的信用变化，用于评价后的小结 */
export function taskCreditLogs(state: AppState, taskId: string) {
  // creditLogs 按新到旧存储，反转即为发生顺序（同一时刻的多条也保持写入顺序）
  return state.creditLogs.filter((l) => l.taskId === taskId).reverse();
}

function addMessage(state: AppState, taskId: string, msg: ChatMessage): AppState {
  const list = state.messages[taskId] ?? [];
  return { ...state, messages: { ...state.messages, [taskId]: [...list, msg] } };
}

let msgSeq = 0;
export const newMessageId = () => `msg_${Date.now().toString(36)}_${(msgSeq++).toString(36)}`;

function bumpUser(state: AppState, userId: string, field: 'runCount' | 'publishCount'): AppState {
  const user = state.users[userId];
  if (!user) return state;
  return { ...state, users: { ...state.users, [userId]: { ...user, [field]: user[field] + 1 } } };
}

/** 跑腿同学在截止时间前送达算准时 */
function deliveredOnTime(task: Task, now: number) {
  const at = [...task.timeline].reverse().find((e) => e.kind === 'delivered')?.at ?? now;
  return at <= task.deadline;
}

export function reduce(state: AppState, action: Action, now = Date.now()): Result {
  const me = state.users[state.meId];

  if (action.type === 'publish') {
    const task: Task = {
      id: action.id,
      ...action.draft,
      createdAt: now,
      publisherId: me.id,
      runnerId: null,
      status: 'open',
      timeline: [{ kind: 'published', at: now, text: `${me.name}发布了任务` }],
      ratingByPublisher: null,
      ratingByRunner: null,
    };
    const next = bumpUser({ ...state, tasks: [task, ...state.tasks] }, me.id, 'publishCount');
    return { ok: true, state: next, message: '发布成功，正在等待附近同学接单' };
  }

  const task = state.tasks.find((t) => t.id === action.taskId);
  if (!task) return { ok: false, error: '任务不存在或已被删除' };
  const role = roleOf(task, me.id);
  const expired = isExpired(task, now);
  const runner = task.runnerId ? state.users[task.runnerId] : null;
  const publisher = state.users[task.publisherId];

  /** 跑腿同学推进一步的通用校验 */
  const runnerStep = (from: TaskStatus, to: TaskStatus, text: string, message: string): Result => {
    if (role !== 'runner') return { ok: false, error: '只有接单的同学可以更新任务进度' };
    if (task.status !== from) return { ok: false, error: `任务当前为「${STATUS_META[task.status].label}」，请按顺序更新进度` };
    return { ok: true, state: transition(state, task.id, to, { kind: to as TimelineEvent['kind'], at: now, text }), message };
  };

  switch (action.type) {
    case 'accept': {
      if (role === 'publisher') return { ok: false, error: '不能接自己发布的任务' };
      if (role === 'runner') return { ok: false, error: '你已经接下这个任务了' };
      if (task.status !== 'open') return { ok: false, error: '该任务已被其他同学接单' };
      if (expired) return { ok: false, error: '任务已过截止时间，无法接单' };
      let next = transition(state, task.id, 'accepted', { kind: 'accepted', at: now, text: '你接下了任务' }, { runnerId: me.id });
      // 演示：发布者收到接单通知后打个招呼
      next = addMessage(next, task.id, { id: newMessageId(), from: publisher.id, text: '谢谢同学接单！有问题随时在这里找我～', at: now + 1000 });
      return { ok: true, state: next, message: '接单成功，已加入「我的任务 → 我接的」' };
    }

    case 'start':
      return runnerStep('accepted', 'started', `你开始了任务，正在前往${task.from}`, '任务已开始');

    case 'pick':
      return runnerStep('started', 'picked', '你已取到物品', '已更新为：已取到物品');

    case 'deliver':
      return runnerStep('picked', 'delivered', `你已送达${task.to}`, '已更新为：已送达');

    case 'complete': {
      const step = runnerStep('delivered', 'completed', `任务已完成，报酬 ¥${task.reward} 已结算`, '');
      if (!step.ok) return step;
      const onTime = deliveredOnTime(task, now);
      let next = bumpUser(step.state, me.id, 'runCount');
      next = addCredit(next, 1, `完成跑腿「${task.title}」`, now, 'run', task.id);
      if (onTime) {
        next = addCredit(next, 1, `准时完成「${task.title}」`, now, 'ontime', task.id);
        return { ok: true, state: next, message: '任务已完成，校园信用 +2' };
      }
      next = addCredit(next, -2, `跑腿超时送达「${task.title}」`, now, 'late', task.id);
      // 30 天内第 3 次超时，额外扣分
      const recentLate = next.creditLogs.filter((l) => l.kind === 'late' && now - l.at < 30 * DAY).length;
      const punished = next.creditLogs.some((l) => l.kind === 'lateRepeat' && now - l.at < 30 * DAY);
      if (recentLate >= 3 && !punished) next = addCredit(next, -5, '30 天内多次超时', now, 'lateRepeat', task.id);
      return { ok: true, state: next, message: '任务已完成，超时送达校园信用 -2' };
    }

    case 'confirm': {
      if (role !== 'publisher') return { ok: false, error: '只有发布者可以确认收到' };
      if (task.status !== 'delivered') return { ok: false, error: '对方还未送达，暂时不能确认' };
      let next = transition(state, task.id, 'completed', {
        kind: 'completed',
        at: now,
        text: `你确认收到，任务已完成，报酬 ¥${task.reward} 已结算`,
      });
      if (task.runnerId) next = bumpUser(next, task.runnerId, 'runCount');
      next = addCredit(next, 1, `及时确认收货「${task.title}」`, now, 'confirm', task.id);
      return { ok: true, state: next, message: '任务已完成，校园信用 +1，给跑腿同学一个评价吧' };
    }

    case 'cancel': {
      if (role !== 'publisher') return { ok: false, error: '只有发布者可以取消任务' };
      if (task.status !== 'open') return { ok: false, error: '已有同学接单，不能直接取消，请先与对方沟通' };
      const next = transition(state, task.id, 'cancelled', { kind: 'cancelled', at: now, text: '你取消了任务' });
      return { ok: true, state: next, message: '任务已取消' };
    }

    case 'rate': {
      if (task.status !== 'completed') return { ok: false, error: '任务完成后才能评价' };
      if (role === 'visitor') return { ok: false, error: '只有任务双方可以评价' };
      const field = role === 'publisher' ? 'ratingByPublisher' : 'ratingByRunner';
      if (task[field]) return { ok: false, error: '你已经评价过了' };
      const target = role === 'publisher' ? runner : publisher;
      let next = updateTask(state, task.id, (t) => ({
        ...t,
        [field]: { ...action.rating, at: now },
        timeline: [...t.timeline, { kind: 'rated', at: now, text: `你评价了${target?.name ?? '对方'}` }],
      }));
      next = addCredit(next, 1, `完成互评「${task.title}」`, now, 'rate', task.id);
      const total = taskCreditLogs(next, task.id).reduce((sum, l) => sum + l.delta, 0);
      return { ok: true, state: next, message: `评价成功，本次互助校园信用 ${total >= 0 ? '+' : ''}${total}` };
    }

    case 'abandon': {
      if (role !== 'runner') return { ok: false, error: '只有接单的同学可以放弃任务' };
      if (task.status !== 'accepted' && task.status !== 'started') return { ok: false, error: '已取到物品后不能放弃，请与发布者沟通' };
      let next = transition(state, task.id, 'open', { kind: 'abandoned', at: now, text: '接单同学放弃了任务，任务重新回到广场' }, { runnerId: null });
      // 聊天记录只属于上一对双方，不留给下一位接单者
      const { [task.id]: _dropped, ...rest } = next.messages;
      next = { ...next, messages: rest };
      next = addCredit(next, -5, `接单后取消「${task.title}」`, now, 'abandon', task.id);
      return { ok: true, state: next, message: '已放弃任务，校园信用 -5' };
    }

    case 'sendMessage':
    case 'receiveMessage': {
      if (role === 'visitor' || !task.runnerId) return { ok: false, error: '接单后才能和对方沟通' };
      const text = action.text.trim();
      if (!text) return { ok: false, error: '消息不能为空' };
      if (text.length > 200) return { ok: false, error: '消息最多 200 字' };
      const counterpart = role === 'publisher' ? task.runnerId : task.publisherId;
      const from = action.type === 'sendMessage' ? me.id : counterpart;
      const next = addMessage(state, task.id, { id: action.id, from, text, at: now });
      return { ok: true, state: next, message: action.type === 'sendMessage' ? '消息发送成功' : undefined };
    }

    case 'report': {
      if (role === 'publisher') return { ok: false, error: '不能举报自己发布的任务' };
      if (state.reports[task.id]) return { ok: false, error: '你已经举报过这个任务，平台正在核实' };
      if (!action.reason) return { ok: false, error: '请选择举报原因' };
      const next = { ...state, reports: { ...state.reports, [task.id]: { reason: action.reason, detail: action.detail.trim(), at: now } } };
      return { ok: true, state: next, message: '举报已提交，平台将在 24 小时内核实处理' };
    }

    /* ---- 演示：模拟另一方的操作 ---- */

    case 'simAccept': {
      if (role !== 'publisher' || task.status !== 'open') return { ok: false, error: '当前状态无法模拟接单' };
      if (expired) return { ok: false, error: '任务已过期' };
      const runnerId = SIMULATED_RUNNERS[Math.floor(Math.random() * SIMULATED_RUNNERS.length)];
      const name = state.users[runnerId].name;
      let next = transition(state, task.id, 'accepted', { kind: 'accepted', at: now, text: `${name}接下了任务` }, { runnerId });
      next = addMessage(next, task.id, { id: newMessageId(), from: runnerId, text: '你好，我接单啦，现在过去～', at: now + 1000 });
      return { ok: true, state: next, message: `${name}接下了你的任务` };
    }

    case 'simAdvance': {
      if (role !== 'publisher' || !runner) return { ok: false, error: '当前状态无法模拟' };
      const steps: Partial<Record<TaskStatus, [TaskStatus, string, string]>> = {
        accepted: ['started', `${runner.name}开始任务，正在前往${task.from}`, `${runner.name}已开始任务`],
        started: ['picked', `${runner.name}已取到物品，正在送来`, `${runner.name}已取到物品`],
        picked: ['delivered', `${runner.name}已送达，请确认收到`, `${runner.name}已送达，请确认收到`],
      };
      const step = steps[task.status];
      if (!step) return { ok: false, error: '当前状态无法模拟' };
      const [to, text, message] = step;
      return { ok: true, state: transition(state, task.id, to, { kind: to as TimelineEvent['kind'], at: now, text }), message };
    }

    case 'simRate': {
      if (role !== 'runner' || task.status !== 'completed' || task.ratingByPublisher) return { ok: false, error: '当前状态无法模拟评价' };
      const onTime = deliveredOnTime(task, now);
      const rating: Rating = onTime
        ? { score: 5, tags: ['很准时', '很靠谱'], comment: '很靠谱，谢谢同学！', at: now }
        : { score: 4, tags: ['沟通顺畅'], comment: '稍微晚了一点，不过提前说了，谢谢～', at: now };
      let next = updateTask(state, task.id, (t) => ({
        ...t,
        ratingByPublisher: rating,
        timeline: [...t.timeline, { kind: 'rated', at: now, text: `${publisher.name}评价了你` }],
      }));
      next = addCredit(next, 1, `获得好评（${publisher.name} ${rating.score} 星）`, now, 'good', task.id);
      return { ok: true, state: next, message: `${publisher.name}给了你 ${rating.score} 星好评，校园信用 +1` };
    }
  }
}
