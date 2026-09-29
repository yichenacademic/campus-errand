import { BadgeCheck, Check, ChevronRight, FileQuestion, Flag, FlaskConical, Lock, LockOpen, MessageCircle, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavBar, Page } from '../components/Layout';
import { RatingSheet } from '../components/RatingSheet';
import {
  Avatar,
  ConfirmDialog,
  CreditLine,
  creditTone,
  Empty,
  Sheet,
  Stars,
  StatusTag,
  TaskTags,
  TypeChip,
  type ConfirmOptions,
} from '../components/ui';
import { creditLevel, REPORT_REASONS } from '../data/credit';
import { LOCATIONS } from '../data/locations';
import { useStore } from '../store/AppStore';
import { displayStatus, roleOf, RUNNER_NEXT, STATUS_META, taskCreditLogs, type DisplayStatus, type Role } from '../store/logic';
import type { CreditLog, Rating, Task, User } from '../types';
import { clock, dayClock, MINUTE, remaining, timeAgo } from '../utils/time';

const STEPS = ['发布', '接单', '出发', '取到', '送达', '完成'];
const STEP_INDEX: Record<DisplayStatus, number> = {
  open: 1,
  accepted: 2,
  started: 3,
  picked: 4,
  delivered: 5,
  completed: 6,
  cancelled: -1,
  expired: -1,
};

function heroCopy(task: Task, role: Role, status: DisplayStatus, runner: User | null, now: number): { title: string; desc: string } {
  const left = remaining(task.deadline, now);
  const who = runner?.name ?? '跑腿同学';
  const due = `约定 ${dayClock(task.deadline, now)} 前送达`;
  const mine = role === 'runner';
  switch (status) {
    case 'open':
      return role === 'publisher'
        ? { title: '等待同学接单', desc: `${timeAgo(task.createdAt, now)}发布，${left}` }
        : { title: '等待接单中', desc: `顺路的话帮一把吧，${left}` };
    case 'accepted':
      return mine
        ? { title: '接单成功', desc: `出发时点击「开始任务」，${due}` }
        : { title: `${who}已接单`, desc: `即将出发，${due}` };
    case 'started':
      return mine
        ? { title: '任务进行中', desc: `正在前往「${task.from}」，取到后记得更新状态` }
        : { title: `${who}正在前往取件`, desc: `前往「${task.from}」，${due}` };
    case 'picked':
      return mine
        ? { title: '已取到物品', desc: `送到「${task.to}」后点击「已送达」，${left}` }
        : { title: `${who}已取到，正在送来`, desc: `送往「${task.to}」，${due}` };
    case 'delivered':
      return mine
        ? { title: '已送达', desc: '确认对方收到后，点击「完成任务」结算报酬' }
        : { title: '已送达，请确认收到', desc: '确认物品无误后点击「确认收到」，任务即完成' };
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
  const [reporting, setReporting] = useState(false);
  const [result, setResult] = useState<CreditLog[] | null>(null);

  // 与首页、我的任务读取同一份 state.tasks，任何页面的操作都会同步到这里
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
      title: '确认接单吗？',
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

  const runnerNext = () => {
    const next = RUNNER_NEXT[task.status];
    if (!next) return;
    if (next.action === 'complete') {
      ask({
        title: '确认完成任务？',
        body: (
          <>
            请确认物品已交到对方手中。完成后报酬 <b style={{ color: 'var(--reward)' }}>¥{task.reward}</b> 将结算给你。
          </>
        ),
        confirmText: '完成任务',
        onConfirm: () => {
          if (run({ type: 'complete', taskId: task.id })) setRating(true);
        },
      });
      return;
    }
    run({ type: next.action, taskId: task.id });
  };

  const confirmReceived = () =>
    ask({
      title: '确认已经收到？',
      body: (
        <>
          确认后任务完成，报酬 <b style={{ color: 'var(--reward)' }}>¥{task.reward}</b> 将结算给{runner?.name ?? '对方'}，此操作无法撤回。
        </>
      ),
      confirmText: '确认收到',
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

  const contact = () => navigate(`/chat/${task.id}`);

  const submitRating = (r: Omit<Rating, 'at'>) => {
    if (!run({ type: 'rate', taskId: task.id, rating: r })) return;
    setRating(false);
    setResult([]); // 下一次渲染时从最新 state 读取本次任务的信用变化
  };

  const abandon = () =>
    ask({
      title: '确定放弃这个任务？',
      body: (
        <>
          接单后取消会影响发布者的安排，<b style={{ color: 'var(--red)' }}>校园信用 -5</b>，并中断「长期无取消记录」。任务会重新回到广场。
        </>
      ),
      confirmText: '仍要放弃',
      cancelText: '继续跑腿',
      danger: true,
      onConfirm: () => run({ type: 'abandon', taskId: task.id }),
    });

  const report = state.reports[task.id];
  const messages = state.messages[task.id] ?? [];
  const lastMessage = messages[messages.length - 1];
  const bothVerified = publisher.verified && (!runner || runner.verified);

  /* ---------- 底部操作栏：按「我的角色 × 任务状态」决定 ---------- */
  let footer: ReactNode = null;
  const bar = (children: ReactNode) => <div className="action-bar">{children}</div>;
  const runnerAction = role === 'runner' ? RUNNER_NEXT[task.status] : undefined;

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
            接下这个任务
          </button>
        </>,
      );
    } else {
      footer = bar(
        <button className="btn btn-secondary btn-block" disabled>
          {status === 'expired' ? '任务已过期' : status === 'cancelled' ? '任务已取消' : status === 'completed' ? '任务已完成' : '该任务已被其他同学接单'}
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
          <span className="hint">自己发布的任务不能自己接，等等附近同学吧</span>
        </>,
      );
    if (status === 'accepted' || status === 'started' || status === 'picked')
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
          <button className="btn btn-primary btn-block" onClick={confirmReceived}>
            <Check size={17} strokeWidth={2.6} />
            确认收到
          </button>
        </>,
      );
  } else if (runnerAction) {
    footer = bar(
      <>
        <button className="btn btn-secondary" onClick={contact}>
          联系发布者
        </button>
        <button className="btn btn-primary btn-block" onClick={runnerNext}>
          {runnerAction.label}
        </button>
      </>,
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
  if (role === 'publisher' && (status === 'accepted' || status === 'started' || status === 'picked')) {
    const label = { accepted: '模拟对方：开始任务', started: '模拟对方：已取到', picked: '模拟对方：已送达' }[status];
    demo = { text: '模拟跑腿同学更新一步进度', label, onClick: () => run({ type: 'simAdvance', taskId: task.id }) };
  }
  if (role === 'runner' && status === 'completed' && !task.ratingByPublisher)
    demo = { text: '模拟发布者给你评价', label: '模拟对方评价我', onClick: () => run({ type: 'simRate', taskId: task.id }) };

  const tone = STATUS_META[status].tone;

  return (
    <Page
      header={
        <NavBar
          title="任务详情"
          right={
            role !== 'publisher' && (
              <button className={`report-btn${report ? ' done' : ''}`} onClick={() => (report ? toast('你已举报该任务，平台正在核实', 'info') : setReporting(true))}>
                <Flag size={15} />
                {report ? '已举报' : '举报'}
              </button>
            )
          }
        />
      }
      footer={footer}
    >
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
          <div className="dm-publisher">
            <Avatar user={publisher} size={22} />
            <CreditLine user={publisher} prefix="发布者 " />
          </div>

          <div className="route-v">
            <div className="rv-item">
              <span className="pin-label from">取</span>
              <div>
                <small>取件地点 · {areaOf(task.from)}</small>
                <strong>{task.from}</strong>
              </div>
            </div>
            <div className="rv-item">
              <span className="pin-label to">送</span>
              <div>
                <small>送达地点 · {areaOf(task.to)}</small>
                <strong>{task.to}</strong>
              </div>
            </div>
          </div>

          <div className="info-grid">
            <div>
              <small>截止时间</small>
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
          <div className="section-title">任务描述</div>
          <p className={`desc${task.description ? '' : ' muted'}`}>{task.description || '发布者没有填写任务描述'}</p>
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
          <div className="trust-line">
            <BadgeCheck size={14} />
            {runner ? (bothVerified ? '双方均为澄湖大学认证学生' : '发布者已通过澄湖大学学生认证') : publisher.verified ? '发布者已通过澄湖大学学生认证' : '发布者尚未完成学生认证，请谨慎接单'}
          </div>
          <PersonRow user={publisher} label="发布者" isMe={publisher.id === me.id} />
          {runner ? (
            <PersonRow user={runner} label="接单者" isMe={runner.id === me.id} />
          ) : (
            status === 'open' && (
              <div className="person" style={{ color: 'var(--text-3)', fontSize: 13 }}>
                还没有同学接单
              </div>
            )
          )}
        </section>

        {role !== 'visitor' && runner && (
          <button className="card section chat-entry" onClick={contact}>
            <span className="ce-icon">
              <MessageCircle size={20} />
            </span>
            <span className="ce-main">
              <strong>任务沟通</strong>
              <span>
                {lastMessage
                  ? `${lastMessage.from === me.id ? '我' : state.users[lastMessage.from]?.name}：${lastMessage.text}`
                  : `和${(role === 'publisher' ? runner : publisher).name}聊聊交接细节`}
              </span>
            </span>
            <ChevronRight size={18} />
          </button>
        )}

        {role === 'runner' && (task.status === 'accepted' || task.status === 'started') && (
          <p className="abandon-row">
            临时有事去不了？
            <button onClick={abandon}>放弃任务（校园信用 -5）</button>
          </p>
        )}

        {report && (
          <div className="report-notice">
            <Flag size={14} />
            你已以「{report.reason}」举报该任务，平台将在 24 小时内核实处理
          </div>
        )}

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
          交接时请当面确认物品；报酬在任务完成后结算。演示环境不会产生真实交易。
        </p>
      </div>

      {confirm && <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />}
      {reporting && (
        <ReportSheet
          onClose={() => setReporting(false)}
          onSubmit={(reason, detail) => {
            if (run({ type: 'report', taskId: task.id, reason, detail })) setReporting(false);
          }}
        />
      )}
      {result && <CreditResult logs={taskCreditLogs(state, task.id)} credit={me.credit} onClose={() => setResult(null)} />}
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

function ReportSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string, detail: string) => void }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  return (
    <Sheet title="举报任务" onClose={onClose}>
      <p className="sheet-desc">举报内容仅平台可见。核实后，发布者将被扣除校园信用并限制发布。</p>
      <div className="option-row" role="radiogroup" aria-label="举报原因">
        {REPORT_REASONS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={reason === r} className={`option${reason === r ? ' active' : ''}`} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <textarea
        className="textarea"
        style={{ marginTop: 14 }}
        maxLength={100}
        placeholder="补充说明（选填），如任务中的可疑内容"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={!reason} onClick={() => onSubmit(reason, detail)}>
        {reason ? '提交举报' : '请选择举报原因'}
      </button>
    </Sheet>
  );
}

/** 评价后的信用小结：列出本次任务带来的每一项信用变化 */
function CreditResult({ logs, credit, onClose }: { logs: CreditLog[]; credit: number; onClose: () => void }) {
  const total = logs.reduce((s, l) => s + l.delta, 0);
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="dialog result-dialog" role="dialog" aria-modal="true" aria-label="评价成功" onClick={(e) => e.stopPropagation()}>
        <div className="result-check">
          <Check size={28} strokeWidth={3} />
        </div>
        <h3>评价成功</h3>
        <div className={`result-total num${total < 0 ? ' minus' : ''}`}>
          校园信用 {total >= 0 ? '+' : ''}
          {total}
        </div>
        <ul className="result-list">
          {logs.map((l) => (
            <li key={l.id}>
              <span>{l.reason.replace(/「.*」/, '')}</span>
              <b className={`num ${l.delta > 0 ? 'plus' : 'minus'}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</b>
            </li>
          ))}
        </ul>
        <p className="result-now">
          当前校园信用 <b className="num">{credit}</b> · {creditLevel(credit).label}
          {credit >= 100 && '（已满分）'}
        </p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
          好的
        </button>
      </div>
    </div>
  );
}
