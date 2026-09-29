import { Check, FileQuestion, FlaskConical, Lock, LockOpen, MessageCircle, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavBar, Page } from '../components/Layout';
import { RatingSheet } from '../components/RatingSheet';
import {
  Avatar,
  ConfirmDialog,
  creditTone,
  Empty,
  Stars,
  StatusTag,
  TaskTags,
  TypeChip,
  type ConfirmOptions,
} from '../components/ui';
import { LOCATIONS } from '../data/locations';
import { useStore } from '../store/AppStore';
import { displayStatus, roleOf, STATUS_META, type DisplayStatus, type Role } from '../store/logic';
import type { Rating, Task, User } from '../types';
import { clock, dayClock, MINUTE, remaining, timeAgo } from '../utils/time';

const STEPS = ['发布', '接单', '送达', '完成'];
const STEP_INDEX: Record<DisplayStatus, number> = { open: 1, accepted: 2, delivered: 3, completed: 4, cancelled: -1, expired: -1 };

function heroCopy(task: Task, role: Role, status: DisplayStatus, runner: User | null, now: number): { title: string; desc: string } {
  const left = remaining(task.deadline, now);
  switch (status) {
    case 'open':
      return role === 'publisher'
        ? { title: '等待同学接单', desc: `${timeAgo(task.createdAt, now)}发布，${left}` }
        : { title: '等待接单中', desc: `顺路的话帮一把吧，${left}` };
    case 'accepted':
      if (role === 'runner') return { title: '你正在跑腿', desc: `请在 ${dayClock(task.deadline, now)} 前送达，${left}` };
      return { title: `${runner?.name ?? '跑腿同学'}正在路上`, desc: `约定 ${dayClock(task.deadline, now)} 前送达` };
    case 'delivered':
      return role === 'publisher'
        ? { title: '对方已送达，请确认', desc: '确认物品无误后点击「确认完成」，报酬将结算给对方' }
        : { title: '已送达，等待确认', desc: '发布者确认后任务完成，你将获得报酬和信用分' };
    case 'completed':
      return { title: '任务已完成', desc: '感谢每一次顺路的帮忙' };
    case 'cancelled':
      return { title: '任务已取消', desc: '发布者在无人接单时取消了任务' };
    case 'expired':
      return { title: '任务已过期', desc: '截止时间前没有同学接单' };
  }
}

export function TaskDetail() {
  const { id } = useParams();
  const { state, me, now, run, toast } = useStore();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [rating, setRating] = useState(false);

  const task = state.tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <Page header={<NavBar title="任务详情" />}>
        <Empty
          icon={<FileQuestion size={28} />}
          title="任务不存在或已被删除"
          desc="可能是链接有误，或演示数据已被重置"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/', { replace: true })}>
              回到任务广场
            </button>
          }
        />
      </Page>
    );
  }

  const role = roleOf(task, me.id);
  const status = displayStatus(task, now);
  const publisher = state.users[task.publisherId];
  const runner = task.runnerId ? state.users[task.runnerId] : null;
  const hero = heroCopy(task, role, status, runner, now);
  const stepIdx = STEP_INDEX[status];
  const soon = status === 'open' && task.deadline - now < 30 * MINUTE;
  const areaOf = (name: string) => LOCATIONS.find((l) => l.name === name)?.area ?? '校园';
  const canSeePrivate = role !== 'visitor';
  const myRatingField = role === 'publisher' ? 'ratingByPublisher' : 'ratingByRunner';
  const needRate = status === 'completed' && role !== 'visitor' && !task[myRatingField];
  const rateTarget = role === 'publisher' ? runner : publisher;

  /* ---------- 操作 ---------- */
  const ask = (o: ConfirmOptions) => setConfirm(o);

  const accept = () =>
    ask({
      title: '确认接下这单？',
      body: (
        <>
          请在 <b>{dayClock(task.deadline, now)}</b> 前把物品从「{task.from}」送到「{task.to}」。
          <br />
          接单后可查看私密信息，超时送达会扣除信用分。
        </>
      ),
      confirmText: '确认接单',
      onConfirm: () => run({ type: 'accept', taskId: task.id }),
    });

  const deliver = () =>
    ask({
      title: '确认已经送达？',
      body: '请确保物品已交到对方手中，或放在约定的位置。',
      confirmText: '已送达',
      onConfirm: () => run({ type: 'deliver', taskId: task.id }),
    });

  const complete = () =>
    ask({
      title: '确认任务已完成？',
      body: (
        <>
          确认后报酬 <b style={{ color: 'var(--reward)' }}>¥{task.reward}</b> 将结算给{runner?.name ?? '对方'}，此操作无法撤回。
        </>
      ),
      confirmText: '确认完成',
      onConfirm: () => {
        if (run({ type: 'confirm', taskId: task.id })) setRating(true);
      },
    });

  const cancel = () =>
    ask({
      title: '取消这个任务？',
      body: '目前还没有同学接单，取消不会影响你的信用分。',
      confirmText: '取消任务',
      cancelText: '保留',
      danger: true,
      onConfirm: () => run({ type: 'cancel', taskId: task.id }),
    });

  const contact = () => toast('演示环境暂不支持聊天，已为双方生成隐私号 170****3321', 'info');

  const submitRating = (r: Omit<Rating, 'at'>) => {
    if (run({ type: 'rate', taskId: task.id, rating: r })) setRating(false);
  };

  /* ---------- 底部操作栏 ---------- */
  let footer: ReactNode = null;
  const bar = (children: ReactNode) => <div className="action-bar">{children}</div>;

  if (role === 'visitor') {
    if (status === 'open') {
      footer = bar(
        <>
          <div className="summary">
            <small>完成可得</small>
            <strong className="num">
              <small>¥</small>
              {task.reward}
            </strong>
          </div>
          <button className="btn btn-primary" style={{ minWidth: 160 }} onClick={accept}>
            顺路接下这单
          </button>
        </>,
      );
    } else {
      footer = bar(
        <button className="btn btn-secondary btn-block" disabled>
          {status === 'expired' ? '任务已过期' : status === 'cancelled' ? '任务已取消' : '已被其他同学接走'}
        </button>,
      );
    }
  } else if (role === 'publisher') {
    if (status === 'open')
      footer = bar(
        <>
          <button className="btn btn-ghost-danger" onClick={cancel}>
            取消任务
          </button>
          <span className="hint">有同学接单时会第一时间通知你</span>
        </>,
      );
    if (status === 'accepted')
      footer = bar(
        <button className="btn btn-secondary btn-block" onClick={contact}>
          <MessageCircle size={17} />
          联系{runner?.name ?? '跑腿同学'}
        </button>,
      );
    if (status === 'delivered')
      footer = bar(
        <>
          <button className="btn btn-secondary" onClick={contact}>
            联系对方
          </button>
          <button className="btn btn-primary btn-block" onClick={complete}>
            <Check size={17} strokeWidth={2.6} />
            确认完成
          </button>
        </>,
      );
  } else if (role === 'runner') {
    if (status === 'accepted')
      footer = bar(
        <>
          <button className="btn btn-secondary" onClick={contact}>
            联系发布者
          </button>
          <button className="btn btn-primary btn-block" onClick={deliver}>
            我已送达
          </button>
        </>,
      );
    if (status === 'delivered')
      footer = bar(
        <button className="btn btn-secondary btn-block" disabled>
          等待{publisher.name}确认完成
        </button>,
      );
  }
  if (needRate && rateTarget) {
    footer = bar(
      <>
        <span className="hint">给{rateTarget.name}一个评价吧</span>
        <button className="btn btn-primary" style={{ minWidth: 140 }} onClick={() => setRating(true)}>
          去评价
        </button>
      </>,
    );
  }

  /* ---------- 演示面板：模拟另一方操作，让流程能在单人演示中走通 ---------- */
  let demo: { text: string; label: string; onClick: () => void } | null = null;
  if (role === 'publisher' && status === 'open')
    demo = { text: '模拟一位同学接下你的任务', label: '模拟同学接单', onClick: () => run({ type: 'simAccept', taskId: task.id }) };
  if (role === 'publisher' && status === 'accepted')
    demo = { text: '模拟跑腿同学把东西送到了', label: '模拟对方已送达', onClick: () => run({ type: 'simDeliver', taskId: task.id }) };
  if (role === 'runner' && status === 'delivered')
    demo = { text: '模拟发布者确认完成并给你评价', label: '模拟对方确认完成', onClick: () => run({ type: 'simConfirm', taskId: task.id }) };

  const tone = STATUS_META[status].tone;

  return (
    <Page header={<NavBar title="任务详情" />} footer={footer}>
      <section className={`status-hero tone-${tone}-hero`}>
        <div className="st-row">
          <h2>{hero.title}</h2>
          <StatusTag status={status} />
        </div>
        <p>{hero.desc}</p>
        {stepIdx > 0 && (
          <div className="steps" aria-label="任务进度">
            {STEPS.map((s, i) => {
              const done = i < stepIdx;
              const current = i === stepIdx && stepIdx < STEPS.length;
              return (
                <div key={s} className={`step${done ? ' done' : ''}${current ? ' current' : ''}`}>
                  <div className="bullet">{done ? <Check size={12} strokeWidth={3} /> : i + 1}</div>
                  {s}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="page-pad">
        <section className="card detail-main">
          <div className="dm-head">
            <TypeChip type={task.type} />
            <TaskTags tags={task.tags} />
          </div>
          <div className="dm-title">
            <h1>{task.title}</h1>
            <div className="reward num">
              <small>¥</small>
              {task.reward}
              <em>跑腿奖励</em>
            </div>
          </div>

          <div className="route-v">
            <div className="rv-item">
              <span className="pin-label from">
                起
              </span>
              <div>
                <strong>{task.from}</strong>
                <small>{areaOf(task.from)}</small>
              </div>
            </div>
            <div className="rv-item">
              <span className="pin-label to">
                终
              </span>
              <div>
                <strong>{task.to}</strong>
                <small>{areaOf(task.to)}</small>
              </div>
            </div>
          </div>

          <div className="info-grid">
            <div>
              <small>希望送达</small>
              <strong className="num">{dayClock(task.deadline, now)} 前</strong>
              {status === 'open' && <em className={soon ? 'soon' : ''}>{remaining(task.deadline, now)}</em>}
            </div>
            <div>
              <small>预计耗时</small>
              <strong className="num">{task.etaMinutes} 分钟</strong>
              <em>步行估算</em>
            </div>
            <div>
              <small>发布时间</small>
              <strong className="num">{clock(task.createdAt)}</strong>
              <em>{timeAgo(task.createdAt, now)}</em>
            </div>
          </div>
        </section>

        <section className="card section">
          <div className="section-title">任务说明</div>
          <p className={`desc${task.description ? '' : ' muted'}`}>{task.description || '发布者没有填写补充说明'}</p>
        </section>

        <section className="card section">
          <div className="section-title">
            私密信息
            <small>仅任务双方可见</small>
          </div>
          {canSeePrivate ? (
            <div className="private-box open">
              <LockOpen size={16} />
              <span>{task.privateNote || '发布者没有填写私密信息'}</span>
            </div>
          ) : (
            <div className="private-box locked">
              <Lock size={16} />
              <span>取件码、门牌号等信息将在接单后可见</span>
            </div>
          )}
        </section>

        <section className="card section">
          <div className="section-title">任务双方</div>
          <PersonRow user={publisher} label="发布者" isMe={publisher.id === me.id} />
          {runner ? (
            <PersonRow user={runner} label="跑腿同学" isMe={runner.id === me.id} />
          ) : (
            status === 'open' && (
              <div className="person" style={{ color: 'var(--text-3)', fontSize: 13 }}>
                还没有同学接单
              </div>
            )
          )}
        </section>

        {status === 'completed' && (task.ratingByPublisher || task.ratingByRunner) && (
          <section className="card section">
            <div className="section-title">互评</div>
            {task.ratingByPublisher && runner && <ReviewItem from={publisher} to={runner} rating={task.ratingByPublisher} meId={me.id} />}
            {task.ratingByRunner && runner && <ReviewItem from={runner} to={publisher} rating={task.ratingByRunner} meId={me.id} />}
          </section>
        )}

        {demo && (
          <div className="demo-panel">
            <div className="dp-head">
              <FlaskConical size={15} />
              演示模式
            </div>
            <p>{demo.text}（真实产品中由对方在自己的手机上操作）</p>
            <button className="btn btn-sm" onClick={demo.onClick}>
              {demo.label}
            </button>
          </div>
        )}

        <section className="card section">
          <div className="section-title">进度记录</div>
          <ol className="timeline">
            {[...task.timeline].reverse().map((e, i) => (
              <li key={`${e.kind}-${e.at}-${i}`}>
                <div className="tl-text">{e.text}</div>
                <div className="tl-time num">{dayClock(e.at, now, false)}</div>
              </li>
            ))}
          </ol>
        </section>

        <p className="safety">
          <ShieldCheck size={14} />
          交接时请当面确认物品；报酬在发布者确认完成后结算。演示环境不会产生真实交易。
        </p>
      </div>

      {confirm && <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />}
      {rating && rateTarget && role !== 'visitor' && (
        <RatingSheet
          target={rateTarget}
          targetRole={role === 'publisher' ? 'runner' : 'publisher'}
          taskTitle={task.title}
          onClose={() => setRating(false)}
          onSubmit={submitRating}
        />
      )}
    </Page>
  );
}

function PersonRow({ user, label, isMe }: { user: User; label: string; isMe: boolean }) {
  return (
    <div className="person">
      <Avatar user={user} size={44} showCheck />
      <div className="pinfo">
        <div className="pname">
          {isMe ? `${user.name}（我）` : user.name}
          <span className="role-label">{label}</span>
        </div>
        <div className="psub">
          {user.verified ? '学生认证' : '未认证'} · {user.college} · {user.grade}
        </div>
        <div className="pstats num">
          <span>跑腿 {user.runCount}</span>
          <span>发布 {user.publishCount}</span>
          <span>好评率 {user.goodRate}%</span>
        </div>
      </div>
      <div className={`credit-badge ${creditTone(user.credit)}`}>
        <b className="num">{user.credit}</b>
        <small>信用分</small>
      </div>
    </div>
  );
}

function ReviewItem({ from, to, rating, meId }: { from: User; to: User; rating: Rating; meId: string }) {
  const name = (u: User) => (u.id === meId ? '我' : u.name);
  return (
    <div className="review">
      <div className="review-head">
        <span className="who">
          <Avatar user={from} size={22} />
          {name(from)} 评价 {name(to)}
        </span>
        <Stars score={rating.score} />
      </div>
      {rating.tags.length > 0 && (
        <div className="tags">
          {rating.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}
      {rating.comment && <p>{rating.comment}</p>}
    </div>
  );
}
