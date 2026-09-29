import type { CreditKind } from '../types';

/** 信用等级：满分 100 */
export const CREDIT_LEVELS = [
  { min: 0, label: '待提升', desc: '暂时只能发布任务，完成认证和互助可提升信用' },
  { min: 70, label: '新人同学', desc: '可接普通跑腿任务' },
  { min: 80, label: '热心同学', desc: '可接大部分任务，发布的任务正常展示' },
  { min: 90, label: '靠谱同学', desc: '可接大件、高奖励任务，发布的任务优先展示' },
  { min: 95, label: '校园之星', desc: '信用极好，主页展示专属勋章' },
];

export function creditLevel(score: number) {
  let idx = 0;
  CREDIT_LEVELS.forEach((l, i) => score >= l.min && (idx = i));
  return { index: idx, ...CREDIT_LEVELS[idx] };
}

export interface CreditRule {
  kind: CreditKind;
  title: string;
  points: string;
  desc: string;
}

/** 加分来源 */
export const CREDIT_GAINS: CreditRule[] = [
  { kind: 'verify', title: '学生身份认证', points: '+5', desc: '一次性，使用校园统一身份认证' },
  { kind: 'run', title: '完成跑腿', points: '+1/次', desc: '接单并完成一次互助' },
  { kind: 'ontime', title: '准时完成', points: '+1/次', desc: '在约定时间前送达' },
  { kind: 'good', title: '获得好评', points: '+1/次', desc: '对方评价 4 星及以上' },
  { kind: 'confirm', title: '及时确认 / 完成互评', points: '+1/次', desc: '发布者及时确认收货，任务完成后认真评价' },
  { kind: 'nocancel', title: '长期无取消记录', points: '+2/月', desc: '连续 30 天没有接单后取消' },
];

/** 扣分行为 */
export const CREDIT_LOSSES: CreditRule[] = [
  { kind: 'abandon', title: '接单后无故取消', points: '-5/次', desc: '接单后放弃任务，会影响发布者的安排' },
  { kind: 'late', title: '多次超时', points: '-2/次', desc: '超时送达每次 -2，30 天内满 3 次额外 -5' },
  { kind: 'complaint', title: '被投诉', points: '-10/次', desc: '经平台核实后扣分' },
  { kind: 'fake', title: '发布虚假任务', points: '-15/次', desc: '并暂停发布权限 7 天' },
];

/** 互评快捷标签（双方通用） */
export const RATING_TAGS = ['很准时', '沟通顺畅', '很靠谱', '态度友好', '回复很快'];

/** 举报理由 */
export const REPORT_REASONS = ['虚假任务', '涉及违规物品', '要求现金代转', '高风险校外跑腿', '骚扰或不当言论', '其他'];
