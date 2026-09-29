import { Ellipsis, HandHelping, KeyRound, Package, Printer, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { TaskType } from '../types';

export interface TaskTypeMeta {
  key: TaskType;
  label: string;
  icon: LucideIcon;
  /** 主色，用于图标与标签文字 */
  color: string;
  /** 浅底色 */
  tint: string;
  /** 发布第一步里的一句话举例 */
  example: string;
  titlePlaceholder: string;
  descPlaceholder: string;
  privatePlaceholder: string;
  /** 同类任务的常见奖励区间，用于推荐奖励 */
  rewardRange: [number, number];
}

export const TASK_TYPES: TaskTypeMeta[] = [
  {
    key: 'express',
    label: '取快递',
    icon: Package,
    color: '#C2410C',
    tint: '#FFF1E7',
    example: '菜鸟驿站、京东快递点',
    titlePlaceholder: '例如：帮取菜鸟驿站快递',
    descPlaceholder: '快递大小、重量、放在哪里比较方便……',
    privatePlaceholder: '取件码、手机尾号等',
    rewardRange: [3, 8],
  },
  {
    key: 'meal',
    label: '带饭 / 代买',
    icon: UtensilsCrossed,
    color: '#B45309',
    tint: '#FEF5DC',
    example: '食堂带饭、取外卖、买奶茶',
    titlePlaceholder: '例如：二食堂顺路带份饭',
    descPlaceholder: '哪个窗口、吃什么、忌口，饭钱怎么结……',
    privatePlaceholder: '外卖柜格口、宿舍门牌号等',
    rewardRange: [2, 6],
  },
  {
    key: 'deliver',
    label: '送东西',
    icon: KeyRound,
    color: '#0F766E',
    tint: '#E3F6F2',
    example: '钥匙、U 盘、资料、书',
    titlePlaceholder: '例如：帮送钥匙到宿舍楼下',
    descPlaceholder: '送什么、多大、交给谁……',
    privatePlaceholder: '收件人联系方式、门牌号等',
    rewardRange: [4, 10],
  },
  {
    key: 'print',
    label: '打印资料',
    icon: Printer,
    color: '#1D4ED8',
    tint: '#EAF1FF',
    example: '讲义、论文、海报',
    titlePlaceholder: '例如：帮忙打印课程讲义',
    descPlaceholder: '页数、黑白/彩色、单双面、是否装订……',
    privatePlaceholder: '文件取件码、网盘提取码等',
    rewardRange: [4, 10],
  },
  {
    key: 'errand',
    label: '校园互助',
    icon: HandHelping,
    color: '#6D28D9',
    tint: '#F1ECFF',
    example: '还书、交材料、排队领取',
    titlePlaceholder: '例如：帮去图书馆还两本书',
    descPlaceholder: '具体要办什么事、需要注意什么……',
    privatePlaceholder: '需要的学号、联系方式等',
    rewardRange: [4, 12],
  },
  {
    key: 'other',
    label: '其他',
    icon: Ellipsis,
    color: '#4B5563',
    tint: '#EEF0F2',
    example: '其他顺路能帮的忙',
    titlePlaceholder: '一句话说清楚需要帮什么',
    descPlaceholder: '把需求描述清楚，更容易被接单……',
    privatePlaceholder: '联系方式、门牌号等',
    rewardRange: [3, 10],
  },
];

export const TASK_TYPE_MAP: Record<TaskType, TaskTypeMeta> = Object.fromEntries(
  TASK_TYPES.map((t) => [t.key, t]),
) as Record<TaskType, TaskTypeMeta>;
