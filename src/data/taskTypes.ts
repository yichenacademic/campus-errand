import { HandHelping, KeyRound, Package, Printer, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { TaskType } from '../types';

export interface TaskTypeMeta {
  key: TaskType;
  label: string;
  icon: LucideIcon;
  /** 主色，用于图标与标签文字 */
  color: string;
  /** 浅底色 */
  tint: string;
  titlePlaceholder: string;
  descPlaceholder: string;
  privatePlaceholder: string;
  /** 同类任务的常见报酬区间，用于发布页提示 */
  rewardRange: [number, number];
}

export const TASK_TYPES: TaskTypeMeta[] = [
  {
    key: 'express',
    label: '代取快递',
    icon: Package,
    color: '#C2410C',
    tint: '#FFF1E7',
    titlePlaceholder: '例如：帮取菜鸟驿站快递',
    descPlaceholder: '快递大小、重量、放在哪里比较方便……',
    privatePlaceholder: '取件码、手机尾号等',
    rewardRange: [3, 8],
  },
  {
    key: 'meal',
    label: '顺路带饭',
    icon: UtensilsCrossed,
    color: '#B45309',
    tint: '#FEF5DC',
    titlePlaceholder: '例如：二食堂顺路带份饭',
    descPlaceholder: '哪个窗口、吃什么、忌口，饭钱怎么结……',
    privatePlaceholder: '宿舍门牌号、联系方式等',
    rewardRange: [3, 6],
  },
  {
    key: 'takeout',
    label: '代取外卖',
    icon: ShoppingBag,
    color: '#BE185D',
    tint: '#FDECF3',
    titlePlaceholder: '例如：帮取外卖送到楼上',
    descPlaceholder: '外卖放在哪里、送到哪一层……',
    privatePlaceholder: '外卖柜格口号、取餐码等',
    rewardRange: [2, 5],
  },
  {
    key: 'print',
    label: '代打印',
    icon: Printer,
    color: '#1D4ED8',
    tint: '#EAF1FF',
    titlePlaceholder: '例如：帮忙打印课程讲义',
    descPlaceholder: '页数、黑白/彩色、单双面、是否装订……',
    privatePlaceholder: '文件网盘链接、提取码等',
    rewardRange: [4, 10],
  },
  {
    key: 'deliver',
    label: '代送物品',
    icon: KeyRound,
    color: '#0F766E',
    tint: '#E3F6F2',
    titlePlaceholder: '例如：帮送钥匙到宿舍楼下',
    descPlaceholder: '送什么、多大、交给谁……',
    privatePlaceholder: '收件人联系方式、门牌号等',
    rewardRange: [4, 10],
  },
  {
    key: 'errand',
    label: '临时代办',
    icon: HandHelping,
    color: '#6D28D9',
    tint: '#F1ECFF',
    titlePlaceholder: '例如：帮去图书馆还两本书',
    descPlaceholder: '具体要办什么事、需要注意什么……',
    privatePlaceholder: '需要的证件信息、联系方式等',
    rewardRange: [4, 12],
  },
];

export const TASK_TYPE_MAP: Record<TaskType, TaskTypeMeta> = Object.fromEntries(
  TASK_TYPES.map((t) => [t.key, t]),
) as Record<TaskType, TaskTypeMeta>;
