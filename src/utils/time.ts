export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const pad = (n: number) => String(n).padStart(2, '0');

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function clock(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 「今天 / 明天 / 昨天 / 9月28日」+ 时刻，今天省略日期 */
export function dayClock(ts: number, now = Date.now(), omitToday = true) {
  const diffDays = Math.round((startOfDay(ts) - startOfDay(now)) / DAY);
  const t = clock(ts);
  if (diffDays === 0) return omitToday ? t : `今天 ${t}`;
  if (diffDays === 1) return `明天 ${t}`;
  if (diffDays === -1) return `昨天 ${t}`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${t}`;
}

/** 发布时间：刚刚 / 12 分钟前 / 2 小时前 / 昨天 18:20 */
export function timeAgo(ts: number, now = Date.now()) {
  const diff = now - ts;
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < 6 * HOUR && startOfDay(ts) === startOfDay(now)) return `${Math.floor(diff / HOUR)} 小时前`;
  return dayClock(ts, now, false);
}

/** 截止剩余时间：还剩 38 分钟 / 还剩 1 小时 20 分 / 已超时 */
export function remaining(deadline: number, now = Date.now()) {
  const diff = deadline - now;
  if (diff <= 0) return '已超时';
  const mins = Math.ceil(diff / MINUTE);
  if (mins < 60) return `还剩 ${mins} 分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `还剩 ${h} 小时 ${m} 分` : `还剩 ${h} 小时`;
}

/** 向上取整到 10 分钟，让截止时间看起来像真人设置的（如 17:30） */
export function roundUpTo10(ts: number) {
  const step = 10 * MINUTE;
  return Math.ceil(ts / step) * step;
}

export function greeting(now = Date.now()) {
  const h = new Date(now).getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
