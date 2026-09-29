import { ArrowUpDown, CircleAlert, Footprints, Lock, Minus, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavBar, Page } from '../components/Layout';
import { ConfirmDialog, TypeIcon, type ConfirmOptions } from '../components/ui';
import { estimateMinutes, LOCATIONS } from '../data/locations';
import { TASK_TYPE_MAP, TASK_TYPES } from '../data/taskTypes';
import { useStore } from '../store/AppStore';
import type { TaskType } from '../types';
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

type Field = 'title' | 'from' | 'to' | 'deadline' | 'reward';

const midReward = (t: TaskType) => {
  const [a, b] = TASK_TYPE_MAP[t].rewardRange;
  return Math.round((a + b) / 2);
};

/** 按「今天 HH:MM」解析自定义时间 */
function parseToday(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function Publish() {
  const { run, toast } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [type, setType] = useState<TaskType>('express');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('研究生宿舍 3 号楼');
  const [deadlineMode, setDeadlineMode] = useState<number | 'custom'>(60);
  const [customTime, setCustomTime] = useState(() => clock(roundUpTo10(Date.now() + 90 * MINUTE)));
  const [reward, setReward] = useState(midReward('express'));
  const [rewardTouched, setRewardTouched] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const fieldRefs = useRef<Partial<Record<Field, HTMLElement | null>>>({});

  const meta = TASK_TYPE_MAP[type];
  const eta = from && to && from !== to ? estimateMinutes(from, to) : null;

  const computeDeadline = () =>
    deadlineMode === 'custom' ? parseToday(customTime) : roundUpTo10(Date.now() + deadlineMode * MINUTE);
  const deadline = computeDeadline();

  const errors = useMemo(() => {
    const e: Partial<Record<Field, string>> = {};
    const t = title.trim();
    if (!t) e.title = '请填写任务标题';
    else if (t.length < 4) e.title = '标题至少 4 个字，说清楚要帮什么';
    if (!from) e.from = '请选择起点';
    if (!to) e.to = '请选择终点';
    if (from && to && from === to) e.to = '起点和终点不能相同';
    if (Number.isNaN(deadline)) e.deadline = '请选择截止时间';
    else if (deadline <= Date.now()) e.deadline = '这个时间已经过了，请重新选择';
    else if (deadline - Date.now() < MIN_LEAD * MINUTE) e.deadline = `至少给跑腿同学留出 ${MIN_LEAD} 分钟`;
    if (!Number.isInteger(reward) || reward < REWARD_MIN || reward > REWARD_MAX) e.reward = `奖励需在 ¥${REWARD_MIN}–${REWARD_MAX} 之间`;
    return e;
  }, [title, from, to, deadline, reward]);

  const show = (f: Field) => (submitted ? errors[f] : undefined);
  const tight = !errors.deadline && eta !== null && deadline - Date.now() < (eta + 10) * MINUTE;
  const dirty = Boolean(title.trim() || description.trim() || privateNote.trim() || from);

  const chooseType = (t: TaskType) => {
    setType(t);
    if (!rewardTouched) setReward(midReward(t));
  };

  const changeReward = (v: number) => {
    setRewardTouched(true);
    setReward(Math.max(REWARD_MIN, Math.min(REWARD_MAX, v)));
  };

  const toggleTag = (t: string) => {
    if (tags.includes(t)) return setTags(tags.filter((x) => x !== t));
    if (tags.length >= MAX_TAGS) return toast(`最多选择 ${MAX_TAGS} 个标签`, 'info');
    // 「小件」和「大件」互斥
    const exclusive = t === '小件' ? '大件' : t === '大件' ? '小件' : null;
    setTags([...tags.filter((x) => x !== exclusive), t]);
  };

  const submit = () => {
    setSubmitted(true);
    const order: Field[] = ['title', 'from', 'to', 'deadline', 'reward'];
    const first = order.find((f) => errors[f]);
    if (first) {
      toast('还有信息没填好，请检查标红的地方', 'error');
      fieldRefs.current[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const id = `p_${Date.now().toString(36)}`;
    const ok = run({
      type: 'publish',
      id,
      draft: {
        type,
        title: title.trim(),
        description: description.trim(),
        privateNote: privateNote.trim(),
        from,
        to,
        reward,
        etaMinutes: eta ?? 15,
        deadline: computeDeadline(),
        tags,
      },
    });
    if (ok) navigate(`/task/${id}`, { replace: true });
  };

  const leave = () => {
    const go = () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1));
    if (!dirty) return go();
    setConfirm({ title: '放弃这次发布？', body: '已填写的内容不会被保存。', confirmText: '放弃', cancelText: '继续填写', danger: true, onConfirm: go });
  };

  return (
    <Page
      header={<NavBar title="发布任务" onBack={leave} bordered />}
      footer={
        <div className="action-bar">
          <div className="summary">
            <small>{eta ? `预计 ${eta} 分钟 · ${Number.isNaN(deadline) ? '' : dayClock(deadline) + ' 前'}` : '填写路线后自动预估耗时'}</small>
            <strong className="num">
              <small>¥</small>
              {reward}
            </strong>
          </div>
          <button className="btn btn-primary" style={{ minWidth: 140 }} onClick={submit}>
            发布任务
          </button>
        </div>
      }
    >
      <div className="page-pad" style={{ paddingTop: 12 }}>
        {/* 1. 类型 */}
        <section className="card form-section">
          <div className="form-label">需要帮什么忙？</div>
          <div className="type-grid" role="radiogroup" aria-label="任务类型">
            {TASK_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={type === t.key}
                className={`type-option${type === t.key ? ' active' : ''}`}
                onClick={() => chooseType(t.key)}
              >
                <TypeIcon type={t.key} size={36} />
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* 2. 内容 */}
        <section className="card form-section">
          <div className="form-label">任务内容</div>
          <label className={`field${show('title') ? ' has-error' : ''}`} ref={(el) => (fieldRefs.current.title = el)}>
            <span className="field-label">
              标题<span style={{ color: 'var(--red)' }}> *</span>
            </span>
            <input className="input" value={title} maxLength={24} placeholder={meta.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
            {show('title') ? (
              <span className="field-error">
                <CircleAlert size={13} />
                {show('title')}
              </span>
            ) : (
              <span className="field-foot">
                <span>一句话说清楚，方便同学快速判断</span>
                <span className="num">{title.length}/24</span>
              </span>
            )}
          </label>
          <label className="field">
            <span className="field-label">补充说明</span>
            <textarea
              className="textarea"
              value={description}
              maxLength={200}
              placeholder={meta.descPlaceholder}
              onChange={(e) => setDescription(e.target.value)}
            />
            <span className="field-foot">
              <span>选填</span>
              <span className="num">{description.length}/200</span>
            </span>
          </label>
          <div className="field">
            <span className="field-label">
              标签 <small style={{ color: 'var(--text-3)' }}>（最多 {MAX_TAGS} 个）</small>
            </span>
            <div className="option-row">
              {TAG_OPTIONS.map((t) => (
                <button key={t} type="button" className={`option${tags.includes(t) ? ' active' : ''}`} onClick={() => toggleTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 3. 路线 */}
        <section className="card form-section">
          <div className="form-label">
            <span>路线</span>
            <small>终点默认为你的宿舍</small>
          </div>
          <div className="route-form">
            <div className="stack">
              <div className={`route-field${show('from') ? ' has-error' : ''}`} ref={(el) => (fieldRefs.current.from = el)}>
                <span className="pin-label from">起</span>
                <select className="select" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="起点">
                  <option value="" disabled>
                    从哪里取 / 在哪里办
                  </option>
                  {LOCATIONS.map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`route-field${show('to') ? ' has-error' : ''}`} ref={(el) => (fieldRefs.current.to = el)}>
                <span className="pin-label to">终</span>
                <select className="select" value={to} onChange={(e) => setTo(e.target.value)} aria-label="终点">
                  <option value="" disabled>
                    送到哪里
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
              aria-label="交换起点和终点"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
            >
              <ArrowUpDown size={16} />
            </button>
          </div>
          {(show('from') || show('to')) && (
            <span className="field-error">
              <CircleAlert size={13} />
              {show('from') ?? show('to')}
            </span>
          )}
          {eta !== null && (
            <div className="estimate">
              <Footprints size={15} />
              按步行估算，跑一趟约 <b className="num">{eta}</b> 分钟
            </div>
          )}
        </section>

        {/* 4. 时间 */}
        <section className="card form-section" ref={(el) => (fieldRefs.current.deadline = el)}>
          <div className="form-label">希望什么时候送到？</div>
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
                className={`input${show('deadline') ? ' has-error' : ''}`}
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                aria-label="自定义截止时间"
              />
              <span className="field-label" style={{ margin: 0 }}>
                前送到
              </span>
            </div>
          )}
          {show('deadline') ? (
            <span className="field-error">
              <CircleAlert size={13} />
              {show('deadline')}
            </span>
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

        {/* 5. 奖励 */}
        <section className="card form-section" ref={(el) => (fieldRefs.current.reward = el)}>
          <div className="form-label">
            <span>跑腿奖励</span>
            <small>完成后由你确认支付</small>
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
            <div className="option-row">
              {[3, 5, 8, 10].map((v) => (
                <button key={v} type="button" className={`option${reward === v ? ' active' : ''}`} style={{ padding: '0 10px' }} onClick={() => changeReward(v)}>
                  ¥{v}
                </button>
              ))}
            </div>
          </div>
          {show('reward') ? (
            <span className="field-error">
              <CircleAlert size={13} />
              {show('reward')}
            </span>
          ) : (
            <div className="reward-hint">
              <Sparkles size={13} />
              「{meta.label}」同学们一般给 ¥{meta.rewardRange[0]}–{meta.rewardRange[1]}，奖励合理更容易被接单
            </div>
          )}
        </section>

        {/* 6. 私密信息 */}
        <section className="card form-section">
          <div className="form-label">
            <span>私密信息</span>
            <small>仅接单同学可见</small>
          </div>
          <div className="private-input">
            <Lock size={16} />
            <input className="input" value={privateNote} maxLength={60} placeholder={meta.privatePlaceholder} onChange={(e) => setPrivateNote(e.target.value)} />
          </div>
        </section>

        <p className="rule-note">
          <ShieldCheck size={14} />
          请勿发布代课、代考、代签到等违反校规的任务。演示环境中的奖励不会产生真实交易。
        </p>
      </div>

      {confirm && <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />}
    </Page>
  );
}
