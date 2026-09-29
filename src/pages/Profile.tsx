import { Award, BadgeCheck, ChevronRight, CircleCheck, CircleMinus, Flame, Lock, RotateCcw, ShieldCheck, Sparkles, ThumbsUp, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Layout';
import { Avatar, ConfirmDialog, Stars, type ConfirmOptions } from '../components/ui';
import { CREDIT_GAINS, CREDIT_LEVELS, CREDIT_LOSSES, creditLevel } from '../data/credit';
import { useStore } from '../store/AppStore';
import { nextStepFor } from '../store/logic';
import type { CreditKind, Rating, User } from '../types';
import { DAY, dayClock } from '../utils/time';

const PERKS = [
  { min: 70, icon: ThumbsUp, title: '接单权限', desc: '可接普通跑腿任务' },
  { min: 90, icon: Flame, title: '大件 / 高奖励', desc: '可接 ¥10 以上任务' },
  { min: 90, icon: TrendingUp, title: '优先展示', desc: '发布的任务排序靠前' },
  { min: 95, icon: Award, title: '校园之星勋章', desc: '主页展示专属勋章' },
];

function Gauge({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="gauge">
      <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden>
        <circle cx="54" cy="54" r={r} stroke="rgba(255,255,255,0.14)" strokeWidth="8" fill="none" />
        <circle
          cx="54"
          cy="54"
          r={r}
          stroke="#8ff0c4"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="g-center">
        <div>
          <b className="num">{score}</b>
          <small>校园信用分</small>
        </div>
      </div>
    </div>
  );
}

export function Profile() {
  const { state, me, now, reset } = useStore();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const level = creditLevel(me.credit);

  // 信用分构成：加分项展示当前进度，扣分项展示近 30 天次数
  const logsOf = (...kinds: CreditKind[]) => state.creditLogs.filter((l) => l.kind && kinds.includes(l.kind));
  const recent = (...kinds: CreditKind[]) => logsOf(...kinds).filter((l) => now - l.at < 30 * DAY).length;
  const lastAbandon = logsOf('abandon')[0]?.at;
  const since = lastAbandon ?? Math.min(...state.creditLogs.map((l) => l.at), now);
  const noCancelDays = Math.floor((now - since) / DAY);
  const gainStatus: Record<string, { text: string; ok: boolean }> = {
    verify: { text: me.verified ? '已认证' : '未认证', ok: me.verified },
    run: { text: `已完成 ${me.runCount} 次`, ok: true },
    ontime: { text: `准时率 ${me.onTimeRate}%`, ok: true },
    good: { text: `好评率 ${me.goodRate}%`, ok: true },
    confirm: { text: `已获得 ${logsOf('confirm', 'rate').length} 次`, ok: true },
    nocancel: { text: `已连续 ${noCancelDays} 天`, ok: noCancelDays >= 30 },
  };
  const lossCount: Record<string, number> = {
    abandon: recent('abandon'),
    late: recent('late'),
    complaint: recent('complaint'),
    fake: recent('fake'),
  };

  // 收到的评价：本次会话中产生的 + 历史评价
  const reviews = useMemo(() => {
    const list: { id: string; from: User; taskTitle: string; rating: Rating }[] = [];
    for (const t of state.tasks) {
      if (t.runnerId === me.id && t.ratingByPublisher) list.push({ id: `${t.id}-p`, from: state.users[t.publisherId], taskTitle: t.title, rating: t.ratingByPublisher });
      if (t.publisherId === me.id && t.ratingByRunner && t.runnerId)
        list.push({ id: `${t.id}-r`, from: state.users[t.runnerId], taskTitle: t.title, rating: t.ratingByRunner });
    }
    for (const r of state.pastReviews) list.push({ id: r.id, from: state.users[r.fromUserId], taskTitle: r.taskTitle, rating: r.rating });
    return list.sort((a, b) => b.rating.at - a.rating.at);
  }, [state.tasks, state.pastReviews, state.users, me.id]);

  const tagStats = useMemo(() => {
    const m = new Map<string, number>();
    reviews.forEach((r) => r.rating.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [reviews]);

  const pending = state.tasks.filter((t) => nextStepFor(t, me.id, now)?.urgent).length;
  const logs = showAllLogs ? state.creditLogs : state.creditLogs.slice(0, 4);

  return (
    <Page tabbar>
      <div className="profile-top">
        <div className="profile-card">
          <Avatar user={me} size={60} />
          <div>
            <h1>
              {me.name}
              {me.verified && (
                <span className="verify-badge">
                  <BadgeCheck size={13} strokeWidth={2.4} />
                  学生认证
                </span>
              )}
            </h1>
            <div className="sub">
              澄湖大学 · {me.college} · {me.grade}
            </div>
          </div>
        </div>

        <section className="credit-card">
          <div className="cc-top">
            <Gauge score={me.credit} />
            <div>
              <small className="cc-kicker">信用等级</small>
              <div className="cc-level">
                <ShieldCheck size={18} />
                {level.label}
              </div>
              <p className="cc-desc">
                {level.desc}。
                {level.index < CREDIT_LEVELS.length - 1 &&
                  `再涨 ${CREDIT_LEVELS[level.index + 1].min - me.credit} 分升级为「${CREDIT_LEVELS[level.index + 1].label}」。`}
              </p>
            </div>
          </div>
          <div className="level-bar">
            <div className="level-track">
              {CREDIT_LEVELS.map((l, i) => (
                <span key={l.label} className={i <= level.index ? 'on' : ''} style={{ flex: 1 }} />
              ))}
            </div>
            <div className="level-labels">
              {CREDIT_LEVELS.map((l, i) => (
                <span key={l.label} className={i === level.index ? 'on' : ''} style={{ flex: 1 }}>
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="page-pad">
        <section className="card stat-grid">
          <div>
            <b className="num">
              {me.runCount}
              <small>次</small>
            </b>
            <span>已完成互助</span>
          </div>
          <div>
            <b className="num">
              {me.onTimeRate}
              <small>%</small>
            </b>
            <span>准时率</span>
          </div>
          <div>
            <b className="num">
              {me.goodRate}
              <small>%</small>
            </b>
            <span>好评率</span>
          </div>
          <div>
            <b className="num">
              {me.publishCount}
              <small>次</small>
            </b>
            <span>发布求助</span>
          </div>
        </section>

        {pending > 0 && (
          <button className="card menu-item" style={{ marginTop: 12 }} onClick={() => navigate('/my-tasks')}>
            <Sparkles size={18} style={{ color: 'var(--reward)' }} />
            <span className="mi-text">
              有 {pending} 个任务等你处理
              <small>确认完成、评价或标记送达</small>
            </span>
            <ChevronRight size={18} />
          </button>
        )}

        <section className="card section">
          <div className="section-title">
            校园信用怎么来
            <small>满分 100</small>
          </div>
          <div className="rule-group-title plus">加分来源</div>
          <ul className="credit-rules">
            {CREDIT_GAINS.map((r) => (
              <li key={r.kind}>
                <div className="cr-main">
                  <strong>
                    {r.title}
                    <b className="num plus">{r.points}</b>
                  </strong>
                  <span>{r.desc}</span>
                </div>
                <span className={`cr-status${gainStatus[r.kind].ok ? ' ok' : ''}`}>
                  {gainStatus[r.kind].ok && <CircleCheck size={13} />}
                  {gainStatus[r.kind].text}
                </span>
              </li>
            ))}
          </ul>
          <div className="rule-group-title minus">扣分行为</div>
          <ul className="credit-rules">
            {CREDIT_LOSSES.map((r) => {
              const n = lossCount[r.kind] ?? 0;
              return (
                <li key={r.kind}>
                  <div className="cr-main">
                    <strong>
                      {r.title}
                      <b className="num minus">{r.points}</b>
                    </strong>
                    <span>{r.desc}</span>
                  </div>
                  <span className={`cr-status${n === 0 ? ' ok' : ' bad'}`}>
                    {n === 0 ? <CircleCheck size={13} /> : <CircleMinus size={13} />}
                    近 30 天 {n} 次
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card section">
          <div className="section-title">
            信用权益
            <small>信用越高，能做的越多</small>
          </div>
          <div className="perks">
            {PERKS.map((p) => {
              const unlocked = me.credit >= p.min;
              const Icon = unlocked ? p.icon : Lock;
              return (
                <div key={p.title} className={`perk${unlocked ? '' : ' locked'}`}>
                  <Icon size={16} />
                  <div>
                    <strong>{p.title}</strong>
                    {unlocked ? p.desc : `信用 ${p.min} 分解锁`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card section">
          <div className="section-title">
            收到的评价
            <small>共 {reviews.length} 条</small>
          </div>
          {tagStats.length > 0 && (
            <div className="tag-cloud">
              {tagStats.map(([t, n]) => (
                <span key={t} className="tag">
                  {t}
                  <b className="num">{n}</b>
                </span>
              ))}
            </div>
          )}
          {reviews.length === 0 && <p className="soft-empty">还没有收到评价，完成一次互助试试吧</p>}
          {reviews.slice(0, 3).map((r) => (
            <div key={r.id} className="review">
              <div className="review-head">
                <span className="who">
                  <Avatar user={r.from} size={22} />
                  {r.from.name}
                  <span className="from-task">· {r.taskTitle}</span>
                </span>
                <Stars score={r.rating.score} size={13} />
              </div>
              {r.rating.comment && <p>{r.rating.comment}</p>}
            </div>
          ))}
        </section>

        <section className="card section">
          <div className="section-title">
            信用记录
            {state.creditLogs.length > 4 && (
              <button className="more-link" onClick={() => setShowAllLogs((v) => !v)}>
                {showAllLogs ? '收起' : `全部 ${state.creditLogs.length} 条`}
                <ChevronRight size={14} style={{ transform: showAllLogs ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
              </button>
            )}
          </div>
          <ul className="log-list">
            {logs.map((l) => (
              <li key={l.id}>
                <div className="l-reason">
                  {l.reason}
                  <div className="l-time num">{dayClock(l.at, now, false)}</div>
                </div>
                <span className={`l-delta num ${l.delta > 0 ? 'plus' : 'minus'}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" style={{ marginTop: 12 }}>
          <button
            className="menu-item"
            onClick={() =>
              setConfirm({
                title: '重置演示数据？',
                body: '所有任务、评价和信用记录将恢复到初始状态。',
                confirmText: '重置',
                danger: true,
                onConfirm: reset,
              })
            }
          >
            <RotateCcw size={18} />
            <span className="mi-text">
              重置演示数据
              <small>数据仅保存在当前浏览器</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </section>
      </div>

      {confirm && <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />}
    </Page>
  );
}
