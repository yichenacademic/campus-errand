export interface CampusLocation {
  name: string;
  area: '生活区' | '教学区' | '校门' | '公共设施';
  /** 校园平面上的相对坐标（单位约 100 米），用于估算步行耗时 */
  x: number;
  y: number;
}

export const LOCATIONS: CampusLocation[] = [
  { name: '东门', area: '校门', x: 10, y: 5 },
  { name: '西门', area: '校门', x: 0, y: 5 },
  { name: '菜鸟驿站', area: '生活区', x: 8, y: 7 },
  { name: '京东快递点', area: '校门', x: 1, y: 6 },
  { name: '一食堂', area: '生活区', x: 6, y: 6 },
  { name: '二食堂', area: '生活区', x: 3, y: 8 },
  { name: '图书馆', area: '教学区', x: 5, y: 3 },
  { name: '教学楼 A 区', area: '教学区', x: 4, y: 2 },
  { name: '教学楼 B 区', area: '教学区', x: 6, y: 1 },
  { name: '实验楼', area: '教学区', x: 8, y: 1 },
  { name: '文印中心', area: '公共设施', x: 5, y: 5 },
  { name: '体育馆', area: '公共设施', x: 2, y: 3 },
  { name: '大学生活动中心', area: '公共设施', x: 7, y: 4 },
  { name: '行政楼', area: '公共设施', x: 3, y: 1 },
  { name: '研究生宿舍 3 号楼', area: '生活区', x: 9, y: 9 },
  { name: '研究生宿舍 5 号楼', area: '生活区', x: 10, y: 8 },
  { name: '本科生宿舍 7 号楼', area: '生活区', x: 2, y: 9 },
  { name: '本科生宿舍 12 号楼', area: '生活区', x: 4, y: 10 },
];

export const LOCATION_NAMES = LOCATIONS.map((l) => l.name);

/** 按曼哈顿距离粗估步行耗时：约 1.5 分钟 / 100 米，外加取件、上楼等固定 5 分钟 */
export function estimateMinutes(from: string, to: string): number {
  const a = LOCATIONS.find((l) => l.name === from);
  const b = LOCATIONS.find((l) => l.name === to);
  if (!a || !b) return 15;
  const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  return Math.max(5, Math.round(dist * 1.5 + 5));
}

export function findLocation(name: string) {
  return LOCATIONS.find((l) => l.name === name);
}

/** 两地之间的大致步行距离（米），用于「距你 300m」「离你最近」 */
export function distanceMeters(from: string, to: string): number {
  const a = findLocation(from);
  const b = findLocation(to);
  if (!a || !b) return 999;
  return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * 100;
}

export function formatDistance(m: number) {
  if (m <= 0) return '就在附近';
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

/** 首页可切换的「我现在在哪」，演示用，不做真实定位 */
export const MY_SPOTS = ['教学楼 A 区', '图书馆', '一食堂', '研究生宿舍 3 号楼', '体育馆', '东门'];
