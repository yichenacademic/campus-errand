import { ArrowUpDown, Check, CircleAlert, Eye, Footprints, Lock, Minus, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavBar, Page } from '../components/Layout';
import { TaskCard } from '../components/TaskCard';
import { ConfirmDialog, TypeIcon, type ConfirmOptions } from '../components/ui';
import { estimateMinutes, LOCATIONS } from '../data/locations';
import { TASK_TYPE_MAP, TASK_TYPES } from '../data/taskTypes';
import { useStore } from '../store/AppStore';
import type { PublishDraft } from '../store/logic';
import type { Task, TaskType } from '../types';
import { clock, dayClock, MINUTE, roundUpTo10 } from '../utils/time';

const DEADLINE_OPTIONS = [
  { minutes: 30, label: '30 分钟内' },
  { minutes: 60, label: '1 小时内' },
  { minutes: 120, label: '2 小时内' },
  { minutes: 180, label: '3 小时内' },
];
const TAG_OPTIONS = ['急', '小件', '大件', '需上楼', '饭钱另付', '易碎'];
const MAX_TAGS = 3;
const MIN_LEAD = 15; // 至少给跑腿同学留出的分钟数
const REWARD_MIN = 1;
const REWARD_MAX = 50;
const STEP_NAMES = ['选择类型', '填写信息', '确认发布'];

type Step = 1 | 2 | 3;
type Field = 'title' | 'from' | 'to' | 'deadline' | 'reward';

/** 按「今天 HH:MM」解析自定义时间 */
function parseToday(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** 推荐奖励：类型基础价 + 路程 + 紧急/大件/上楼等加价，落在同类任务的常见区间内 */
function recommendReward(type: TaskType, eta: number | null, minutesLeft: number, tags: string[]) {
  const [lo, hi] = TASK_TYPE_MAP[type].rewardRange;
  let r = lo + Math.round((eta ?? 12) / 10);
  if (minutesLeft <= 30 || tags.includes('急')) r += 1;
  if (tags.includes('大件')) r += 2;
  if (tags.includes('需上楼')) r += 1;
  return Math.max(lo, Math.min(hi, r));
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span className="field-error">
      <CircleAlert size={13} />
      {text}
    </span>
  );
}

export function Publish() {
  const { state, run, toast } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<TaskType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('研究生宿舍 3 号楼');
  const [deadlineMode, setDeadlineMode] = useState<number | 'custom'>(60);
  const [customTime, setCustomTime] = useState(() => clock(roundUpTo10(Date.now() + 90 * MINUTE)));
  /** null 表示跟随推荐值，用户手动调整后固定 */
  const [customReward, setCustomReward] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const fieldRefs = useRef<Partial<Record<Field, HTMLElement | null>>>({});

  // 切换步骤时回到顶部
  useEffect(() => {
    document.querySelector('.page-body')?.scrollTo({ top: 0 });
  }, [step]);

  const meta = type ? TASK_TYPE_MAP[type] : TASK_TYPES[0];
  const eta = from && to && from !== to ? estimateMinutes(from, to) : null;
  const computeDeadline = () => (deadlineMode === 'custom' ? parseToday(customTime) : roundUpTo10(Date.now() + deadlineMode * MINUTE));
  const deadline = computeDeadline();
  const minutesLeft = Number.isNaN(deadline) ? 999 : (deadline - Date.now()) / MINUTE;
  const recommended = recommendReward(type ?? 'other', eta, minutesLeft, tags);
  const reward = customReward ?? recommended;

  const validate = () => {
    const e: Partial<Record<Field, string>> = {};
    const t = title.trim();
    const d = computeDeadline();
    if (!t) e.title = '请填写任务标题';
    else if (t.length < 4) e.title = '标题至少 4 个字，说清楚要帮什么';
    if (!from) e.from = '请选择取件地点';
    if (!to) e.to = '请选择送达地点';
    if (from && to && from === to) e.to = '取件地点和送达地点不能相同';
    if (Number.isNaN(d)) e.deadline = '请选择希望完成时间';
    else if (d <= Date.now()) e.deadline = '这个时间已经过了，请重新选择';
    else if (d - Date.now() < MIN_LEAD * MINUTE) e.deadline = `至少给跑腿同学留出 ${MIN_LEAD} 分钟`;
    if (!Number.isInteger(reward) || reward < REWARD_MIN || reward > REWARD_MAX) e.reward = `奖励需在 ¥${REWARD_MIN}–${REWARD_MAX} 之间`;
    return e;
  };
  const errors = validate();
  const err = (f: Field) => (showErrors ? errors[f] : undefined);
  const tight = !errors.deadline && eta !== null && minutesLeft < eta + 10;
  const dirty = Boolean(type || title.trim() || description.trim() || privateNote.trim() || from);

  const buildDraft = (): PublishDraft => ({
    type: type ?? 'other',
    title: title.trim(),
    description: description.trim(),
    privateNote: privateNote.trim(),
    from,
    to,
    reward,
    etaMinutes: eta ?? 15,
    deadline: computeDeadline(),
    tags,
  });

  /* ---------- 步骤切换 ---------- */
  const chooseType = (t: TaskType) => {
    setType(t);
    setStep(2);
  };

  const toPreview = () => {
    setShowErrors(true);
    const e = validate();
    const order: Field[] = ['title', 'from', 'to', 'deadline', 'reward'];
    const first = order.find((f) => e[f]);
    if (first) {
      toast('还有信息没填好，请检查标红的地方', 'error');
      fieldRefs.current[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep(3);
  };

  const publish = () => {
    // 预览停留期间时间可能已经过去，发布前再校验一次
    const e = validate();
    if (Object.keys(e).length) {
      setShowErrors(true);
      setStep(2);
      toast(e.deadline ?? '信息有变化，请重新检查', 'error');
      return;
    }
    const id = `p_${Date.now().toString(36)}`;
    if (run({ type: 'publish', id, draft: buildDraft() })) navigate(`/task/${id}`, { replace: true });
  };

  const leave = () => {
    const go = () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1));
    if (!dirty) return go();
    setConfirm({ title: '放弃这次发布？', body: '已填写的内容不会被保存。', confirmText: '放弃', cancelText: '继续填写', danger: true, onConfirm: go });
  };

  const back = () => (step === 1 ? leave() : setStep((step - 1) as Step));

  const toggleTag = (t: string) => {
    if (tags.includes(t)) return setTags(tags.filter((x) => x !== t));
    if (tags.length >= MAX_TAGS) return toast(`最多选择 ${MAX_TAGS} 个标签`, 'info');
    const exclusive = t === '小件' ? '大件' : t === '大件' ? '小件' : null;
    setTags([...tags.filter((x) => x !== exclusive), t]);
  };

  const changeReward = (v: number) => setCustomReward(Math.max(REWARD_MIN, Math.min(REWARD_MAX, v)));

  /* ---------- 底部栏 ---------- */
  let footer: ReactNode = null;
  if (step === 2)
    footer = (
      <div className="action-bar">
        <button className="btn btn-secondary" onClick={() => setStep(1)}>
          上一步
        </button>
        <button className="btn btn-primary btn-block" onClick={toPreview}>
          下一步：预览任务
        </button>
      </div>
    );
  if (step === 3)
    footer = (
      <div className="action-bar">
        <button className="btn btn-secondary" onClick={() => setStep(2)}>
          返回修改
        </button>
        <button className="btn btn-primary btn-block" onClick={publish}>
          <Check size={17} strokeWidth={2.6} />
          确认发布
        </button>
      </div>
    );

  const previewTask: Task = {
    ...buildDraft(),
    id: 'preview',
    createdAt: Date.now(),
    publisherId: state.meId,
    runnerId: null,
    status: 'open',
    timeline: [],
    ratingByPublisher: null,
    ratingByRunner: null,
  };

  return (
    <Page header={<NavBar title="发布任务" onBack={back} bordered />} footer={footer}>
      <div className="wizard-steps" aria-label={`第 ${step} 步，共 3 步`}>
        {STEP_NAMES.map((name, i) => {
          const n = i + 1;
          return (
            <FragmentStep key={name} showLine={i > 0} lineDone={step >= n}>
              <span className={`ws${step === n ? ' on' : ''}${step > n ? ' done' : ''}`}>
                <b>{step > n ? <Check size={11} strokeWidth={3} /> : n}</b>
                {name}
              </span>
            </FragmentStep>
          );
        })}
      </div>

      <div className="page-pad">
        {/* ---------- 第一步：选择类型 ---------- */}
        {step === 1 && (
          <>
            <div className="step-intro">
              <h2>需要帮什么忙？</h2>
              <p>选择任务类型，同学们能更快判断是否顺路</p>
            </div>
            <div className="type-list" role="radiogroup" aria-label="任务类型">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={type === t.key}
                  className={`type-card${type === t.key ? ' active' : ''}`}
                  onClick={() => chooseType(t.key)}
                >
                  <TypeIcon type={t.key} size={40} />
                  <div>
                    <strong>{t.label}</strong>
                    <span className="ex">{t.example}</span>
                  </div>
                </button>
              ))}
            </div>
            <p className="rule-note">
              <ShieldCheck size={14} />
              请勿发布代课、代考、代签到等违反校规的任务。
            </p>
          </>
        )}

        {/* ---------- 第二步：填写信息 ---------- */}
        {step === 2 && type && (
          <>
            <section className="card form-section" style={{ marginTop: 12 }}>
              <div className="form-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TypeIcon type={type} size={28} />
                  {meta.label}
                </span>
                <button type="button" className="more-link" onClick={() => setStep(1)}>
                  更换类型
                </button>
              </div>
              <label className={`field${err('title') ? ' has-error' : ''}`} ref={(el) => (fieldRefs.current.title = el)}>
                <span className="field-label">
                  任务标题<span style={{ color: 'var(--red)' }}> *</span>
                </span>
                <input className="input" value={title} maxLength={24} placeholder={meta.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
                {err('title') ? (
                  <FieldError text={err('title')} />
                ) : (
                  <span className="field-foot">
                    <span>一句话说清楚，方便同学快速判断</span>
                    <span className="num">{title.length}/24</span>
                  </span>
                )}
              </label>
              <label className="field">
                <span className="field-label">任务描述</span>
                <textarea className="textarea" value={description} maxLength={200} placeholder={meta.descPlaceholder} onChange={(e) => setDescription(e.target.value)} />
                <span className="field-foot">
                  <span>选填</span>
                  <span className="num">{description.length}/200</span>
                </span>
              </label>
              <div className="field">
                <span className="field-label">标签（选填，最多 {MAX_TAGS} 个）</span>
                <div className="option-row">
                  {TAG_OPTIONS.map((t) => (
                    <button key={t} type="button" className={`option${tags.includes(t) ? ' active' : ''}`} onClick={() => toggleTag(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="card form-section">
              <div className="form-label">
                <span>路线</span>
                <small>送达地点默认为你的宿舍</small>
              </div>
              <div className="route-form">
                <div className="stack">
                  <div className={`route-field${err('from') ? ' has-error' : ''}`} ref={(el) => (fieldRefs.current.from = el)}>
                    <span className="pin-label from">取</span>
                    <select className="select" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="取件地点">
                      <option value="" disabled>
                        取件地点
                      </option>
                      {LOCATIONS.map((l) => (
                        <option key={l.name} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`route-field${err('to') ? ' has-error' : ''}`} ref={(el) => (fieldRefs.current.to = el)}>
                    <span className="pin-label to">送</span>
                    <select className="select" value={to} onChange={(e) => setTo(e.target.value)} aria-label="送达地点">
                      <option value="" disabled>
                        送达地点
                      </option>
                      {LOCATIONS.map((l) => (
                        <option key={l.name} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="swap-btn"
                  aria-label="交换取件地点和送达地点"
                  onClick={() => {
                    setFrom(to);
                    setTo(from);
                  }}
                >
                  <ArrowUpDown size={16} />
                </button>
              </div>
              <FieldError text={err('from') ?? err('to')} />
              {eta !== null && (
                <div className="estimate">
                  <Footprints size={15} />
                  按步行估算，跑一趟约 <b className="num">{eta}</b> 分钟
                </div>
              )}
            </section>

            <section className="card form-section" ref={(el) => (fieldRefs.current.deadline = el)}>
              <div className="form-label">希望完成时间</div>
              <div className="option-row">
                {DEADLINE_OPTIONS.map((o) => (
                  <button key={o.minutes} type="button" className={`option${deadlineMode === o.minutes ? ' active' : ''}`} onClick={() => setDeadlineMode(o.minutes)}>
                    {o.label}
                  </button>
                ))}
                <button type="button" className={`option${deadlineMode === 'custom' ? ' active' : ''}`} onClick={() => setDeadlineMode('custom')}>
                  自定义
                </button>
              </div>
              {deadlineMode === 'custom' && (
                <div className="time-custom">
                  <span className="field-label" style={{ margin: 0 }}>
                    今天
                  </span>
                  <input
                    type="time"
                    className={`input${err('deadline') ? ' has-error' : ''}`}
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    aria-label="自定义完成时间"
                  />
                  <span className="field-label" style={{ margin: 0 }}>
                    前完成
                  </span>
                </div>
              )}
              {err('deadline') ? (
                <FieldError text={err('deadline')} />
              ) : (
                !Number.isNaN(deadline) &&
                deadline > Date.now() && (
                  <div className="deadline-preview">
                    将显示为：<b>希望 {dayClock(deadline)} 前送到</b>
                    {tight && <span style={{ color: 'var(--orange)' }}>（时间有点紧，可能不容易被接单）</span>}
                  </div>
                )
              )}
            </section>

            <section className="card form-section" ref={(el) => (fieldRefs.current.reward = el)}>
              <div className="form-label">
                <span>奖励金额</span>
                <small>任务完成后结算</small>
              </div>
              <div className="reward-row">
                <div className="stepper">
                  <button type="button" onClick={() => changeReward(reward - 1)} disabled={reward <= REWARD_MIN} aria-label="减少奖励">
                    <Minus size={18} />
                  </button>
                  <span className="value num">
                    <small>¥</small>
                    {reward}
                  </span>
                  <button type="button" onClick={() => changeReward(reward + 1)} disabled={reward >= REWARD_MAX} aria-label="增加奖励">
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <div className={`recommend${reward === recommended ? ' matched' : ''}`}>
                <span>
                  <Sparkles size={13} style={{ verticalAlign: -1, marginRight: 4 }} />
                  推荐 <b className="num">¥{recommended}</b>，更容易被接单
                </span>
                {reward !== recommended ? (
                  <button type="button" className="btn" onClick={() => setCustomReward(null)}>
                    用推荐价
                  </button>
                ) : (
                  <span style={{ fontSize: 12 }}>已采用</span>
                )}
              </div>
              <FieldError text={err('reward')} />
              <div className="reward-hint">
                根据类型、路程和紧急程度估算；「{meta.label}」常见 ¥{meta.rewardRange[0]}–{meta.rewardRange[1]}
              </div>
            </section>

            <section className="card form-section">
              <div className="form-label">
                <span>私密信息</span>
                <small>选填 · 仅接单同学可见</small>
              </div>
              <div className="private-input">
                <Lock size={16} />
                <input className="input" value={privateNote} maxLength={60} placeholder={meta.privatePlaceholder} onChange={(e) => setPrivateNote(e.target.value)} />
              </div>
            </section>
          </>
        )}

        {/* ---------- 第三步：确认发布 ---------- */}
        {step === 3 && type && (
          <>
            <div className="step-intro">
              <h2>确认任务信息</h2>
              <p>发布后会立即出现在任务广场，附近同学都能看到</p>
            </div>
            <div className="preview-label">
              <Eye size={13} />
              在任务广场中的样子
            </div>
            <TaskCard task={previewTask} preview />

            <section className="card section">
              <ul className="preview-list">
                <li>
                  <span>任务类型</span>
                  <b>{meta.label}</b>
                </li>
                <li>
                  <span>取件地点</span>
                  <b>{from}</b>
                </li>
                <li>
                  <span>送达地点</span>
                  <b>{to}</b>
                </li>
                <li>
                  <span>希望完成时间</span>
                  <b className="num">{dayClock(previewTask.deadline)} 前</b>
                </li>
                <li>
                  <span>预计耗时</span>
                  <b className="num">约 {previewTask.etaMinutes} 分钟</b>
                </li>
                <li>
                  <span>奖励金额</span>
                  <b className="num" style={{ color: 'var(--reward)', fontWeight: 700 }}>
                    ¥{reward}
                  </b>
                </li>
                <li>
                  <span>任务描述</span>
                  <b className={description.trim() ? '' : 'muted'}>{description.trim() || '未填写'}</b>
                </li>
                <li>
                  <span>私密信息</span>
                  <b className={privateNote.trim() ? '' : 'muted'}>{privateNote.trim() ? `${privateNote.trim()}（接单后可见）` : '未填写'}</b>
                </li>
              </ul>
            </section>
            <p className="rule-note">
              <ShieldCheck size={14} />
              无人接单时可随时取消，不影响信用分。演示环境中的奖励不会产生真实交易。
            </p>
          </>
        )}
      </div>

      {confirm && <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />}
    </Page>
  );
}

function FragmentStep({ showLine, lineDone, children }: { showLine: boolean; lineDone: boolean; children: ReactNode }) {
  return (
    <>
      {showLine && <i className={`line${lineDone ? ' done' : ''}`} />}
      {children}
    </>
  );
}
