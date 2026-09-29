/**
 * 只滚动元素所在页面的内容区（.page-body）。
 * 原生 scrollIntoView 会连带滚动 overflow: hidden 的外层容器（手机外框），导致顶栏被推出可视区域。
 */
export function scrollWithinPage(el: Element | null, align: 'start' | 'center' | 'end' = 'start', smooth = true) {
  const body = el?.closest('.page-body') as HTMLElement | null;
  if (!el || !body) return;
  const b = body.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  let top = body.scrollTop + (r.top - b.top);
  if (align === 'center') top -= (b.height - r.height) / 2;
  if (align === 'end') top -= b.height - r.height;
  body.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
}
