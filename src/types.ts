export type TaskType = 'express' | 'meal' | 'deliver' | 'print' | 'errand' | 'other';

/**
 * 任务状态机：
 * open(待接单) → accepted(已接单) → started(进行中) → picked(已取到) → delivered(已送达) → completed(已完成)
 * open → cancelled(已取消)
 * 过期（open 且超过截止时间）是派生状态，不单独存储。
 */
export type TaskStatus = 'open' | 'accepted' | 'started' | 'picked' | 'delivered' | 'completed' | 'cancelled';

export interface User {
  id: string;
  /** 对外只展示「姓 + 同学」，保护隐私 */
  name: string;
  surname: string;
  color: string;
  college: string;
  grade: string;
  verified: boolean;
  credit: number;
  /** 累计完成跑腿次数 */
  runCount: number;
  /** 累计发布任务次数 */
  publishCount: number;
  /** 好评率 0-100 */
  goodRate: number;
  /** 准时率 0-100 */
  onTimeRate: number;
}

export interface Rating {
  score: number;
  tags: string[];
  comment: string;
  at: number;
}

export type TimelineKind = 'published' | 'accepted' | 'started' | 'picked' | 'delivered' | 'completed' | 'cancelled' | 'rated' | 'abandoned';

export interface TimelineEvent {
  kind: TimelineKind;
  at: number;
  text: string;
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  /** 取件码、门牌号等，仅发布者和接单者可见 */
  privateNote: string;
  from: string;
  to: string;
  reward: number;
  etaMinutes: number;
  deadline: number;
  createdAt: number;
  tags: string[];
  publisherId: string;
  runnerId: string | null;
  status: TaskStatus;
  timeline: TimelineEvent[];
  /** 发布者对跑腿同学的评价 */
  ratingByPublisher: Rating | null;
  /** 跑腿同学对发布者的评价 */
  ratingByRunner: Rating | null;
}

export type CreditKind =
  | 'verify'
  | 'run'
  | 'ontime'
  | 'good'
  | 'rate'
  | 'confirm'
  | 'nocancel'
  | 'abandon'
  | 'late'
  | 'lateRepeat'
  | 'complaint'
  | 'fake';

export interface CreditLog {
  id: string;
  delta: number;
  reason: string;
  at: number;
  kind?: CreditKind;
  /** 关联的任务，用于「本次互助信用变化」小结 */
  taskId?: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  at: number;
}

export interface Report {
  reason: string;
  detail: string;
  at: number;
}

export interface PastReview {
  id: string;
  fromUserId: string;
  taskTitle: string;
  rating: Rating;
}

export interface AppState {
  version: number;
  savedAt: number;
  meId: string;
  users: Record<string, User>;
  tasks: Task[];
  creditLogs: CreditLog[];
  pastReviews: PastReview[];
  /** 任务内聊天记录（系统消息由任务时间线派生，不单独存储） */
  messages: Record<string, ChatMessage[]>;
  /** 当前用户对任务的举报 */
  reports: Record<string, Report>;
}
