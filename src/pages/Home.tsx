import { MapPin, Plus, Search, SearchX, X } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '../components/Layout';
import { TaskCard } from '../components/TaskCard';
import { Avatar, Empty } from '../components/ui';
import { TASK_TYPES } from '../data/taskTypes';
import { useStore } from '../store/AppStore';
import { displayStatus } from '../store/logic';
import type { TaskType } from '../types';
import { greeting } from '../utils/time';
import { useSessionState } from '../utils/useSessionState';

type Sort = 'latest' | 'reward' | 'deadline';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'latest', label: '最新' },
  { key: 'deadline', label: '快截止' },
  { key: 'reward', label: '奖励高' },
];

export function Home() {
  const { state, me, now, refresh } = useStore();
  const navigate = useNavigate();
  const [category, setCategory] = useSessionState<TaskType | 'all'>('home.category', 'all');
  const [sort, setSort] = useSessionState<Sort>('home.sort', 'latest');
  const [keyword, setKeyword] = useSessionState('home.keyword', '');

  // 广场只展示仍可接单的任务（已接单、已过期的不再打扰大家）
  const openTasks = useMemo(() => state.tasks.filter((t) => displayStatus(t, now) === 'open'), [state.tasks, now]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: openTasks.length };
    for (const t of openTasks) map[t.type] = (map[t.type] ?? 0) + 1;
    return map;
  }, [openTasks]);

  const list = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const filtered = openTasks.filter((t) => {
      if (category !== 'all' && t.type !== category) return false;
      if (!kw) return true;
      return [t.title, t.from, t.to, t.description].some((s) => s.toLowerCase().includes(kw));
    });
    const sorted = [...filtered];
    if (sort === 'latest') sorted.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'deadline') sorted.sort((a, b) => a.deadline - b.deadline);
    if (sort === 'reward') sorted.sort((a, b) => b.reward - a.reward || a.deadline - b.deadline);
    return sorted;
  }, [openTasks, category, keyword, sort]);

  const helpers = new Set(state.tasks.filter((t) => t.runnerId && t.status !== 'cancelled').map((t) => t.runnerId)).size;
  const othersOpen = openTasks.filter((t) => t.publisherId !== me.id);
  const totalReward = othersOpen.reduce((s, t) => s + t.reward, 0);

  return (
    <Page tabbar>
      <div className="home-top">
        <div className="home-bar">
          <span className="campus-pill">
            <MapPin size={15} strokeWidth={2.4} />
            澄湖大学 · 主校区
          </span>
          <Link to="/me" aria-label="我的主页">
            <Avatar user={me} size={34} showCheck />
          </Link>
        </div>

        <div className="hello">
          <h1>
            {greeting(now)}，{me.name}
          </h1>
          <p>顺路帮个忙，校园更近一点</p>
        </div>

        <section className="hero">
          <svg className="hero-path" width="140" height="70" viewBox="0 0 140 70" fill="none" aria-hidden>
            <path d="M4 60c30 0 34-40 66-40s36 30 66 30" stroke="#fff" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
            <circle cx="136" cy="50" r="5" fill="#fff" />
          </svg>
          <div className="hero-kicker">
            <i className="live-dot" />
            互助广场 · 实时
          </div>
          <h2>
            此刻有<b className="num">{othersOpen.length}</b>位同学需要帮忙
          </h2>
          <div className="hero-row">
            <div className="hero-stats">
              <div>
                <b className="num">¥{totalReward}</b>待领取奖励
              </div>
              <div>
                <b className="num">{helpers}</b>位同学在帮忙
              </div>
            </div>
            <button className="btn" onClick={() => navigate('/publish')}>
              <Plus size={16} strokeWidth={2.6} />
              我要求助
            </button>
          </div>
        </section>

        <label className="search">
          <Search size={18} />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索任务或地点，如「菜鸟驿站」"
            aria-label="搜索任务"
          />
          {keyword && (
            <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => setKeyword('')} aria-label="清空搜索">
              <X size={16} />
            </button>
          )}
        </label>
      </div>

      <div className="filter-bar">
        <div className="chips" role="tablist" aria-label="任务类型">
          <button role="tab" aria-selected={category === 'all'} className={`chip${category === 'all' ? ' active' : ''}`} onClick={() => setCategory('all')}>
            全部 <span className="count num">{counts.all ?? 0}</span>
          </button>
          {TASK_TYPES.map((t) => {
            const Icon = t.icon;
            const active = category === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                className={`chip${active ? ' active' : ''}`}
                onClick={() => setCategory(t.key)}
              >
                <Icon size={14} style={{ color: active ? '#fff' : t.color }} />
                {t.label}
                <span className="count num">{counts[t.key] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="sort-row">
          <span className="result">共 {list.length} 个任务</span>
          <div className="sort-tabs">
            {SORTS.map((s) => (
              <button key={s.key} className={sort === s.key ? 'active' : ''} onClick={() => setSort(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-pad">
        {list.length > 0 ? (
          <>
            <div className="task-list">
              {list.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
            <div className="list-end">— 看看有没有顺路的，帮一把吧 —</div>
          </>
        ) : openTasks.length === 0 ? (
          <Empty
            icon={<SearchX size={28} />}
            title="广场上的任务都被接完啦"
            desc="演示任务会随时间过期，可以刷新一批新任务，你自己的任务和记录不受影响"
            action={
              <button className="btn btn-secondary btn-sm" onClick={refresh}>
                刷新广场任务
              </button>
            }
          />
        ) : (
          <Empty
            icon={<SearchX size={28} />}
            title={keyword ? `没有找到「${keyword}」相关的任务` : '这个分类暂时没有任务'}
            desc="换个分类看看，或者发布你自己的需求"
            action={
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setKeyword('');
                  setCategory('all');
                }}
              >
                查看全部任务
              </button>
            }
          />
        )}
      </div>
    </Page>
  );
}
