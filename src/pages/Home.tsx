import { Backpack, Check, Compass, MapPin, Navigation, Search, SearchX, X, Zap } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Layout';
import { TaskCard } from '../components/TaskCard';
import { Avatar, Empty, Sheet } from '../components/ui';
import { distanceMeters, findLocation, MY_SPOTS } from '../data/locations';
import { TASK_TYPES } from '../data/taskTypes';
import { useStore } from '../store/AppStore';
import { displayStatus } from '../store/logic';
import type { Task, TaskType } from '../types';
import { greeting, MINUTE } from '../utils/time';
import { useSessionState } from '../utils/useSessionState';
import { scrollWithinPage } from '../utils/scroll';

type Sort = 'latest' | 'reward' | 'deadline' | 'distance';
type Scene = 'all' | 'along' | 'urgent' | 'afterClass';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'latest', label: '最新' },
  { key: 'distance', label: '最近' },
  { key: 'deadline', label: '快截止' },
  { key: 'reward', label: '奖励高' },
];

/** 取件点离我 400 米以内，算「顺路」 */
const ALONG_METERS = 400;

/** 校园场景筛选：不做真实定位，基于 Mock 的「我现在在哪」和地点坐标计算 */
function matchScene(t: Task, scene: Scene, spot: string, now: number) {
  if (scene === 'along') return distanceMeters(spot, t.from) <= ALONG_METERS;
  if (scene === 'urgent') return t.tags.includes('急') || t.deadline - now <= 30 * MINUTE;
  if (scene === 'afterClass') return findLocation(t.to)?.area === '生活区' && findLocation(t.from)?.area !== '生活区';
  return true;
}

export function Home() {
  const { state, me, now, refresh, toast } = useStore();
  const [category, setCategory] = useSessionState<TaskType | 'all'>('home.category', 'all');
  const [sort, setSort] = useSessionState<Sort>('home.sort', 'latest');
  const [keyword, setKeyword] = useSessionState('home.keyword', '');
  const [scene, setScene] = useSessionState<Scene>('home.scene', 'all');
  const [spot, setSpot] = useSessionState('home.spot', '教学楼 A 区');
  const [picking, setPicking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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
      // 场景筛选是「去帮别人」的视角，不包含自己发布的任务，与场景计数保持一致
      if (scene !== 'all' && (t.publisherId === me.id || !matchScene(t, scene, spot, now))) return false;
      if (!kw) return true;
      return [t.title, t.from, t.to, t.description].some((s) => s.toLowerCase().includes(kw));
    });
    const sorted = [...filtered];
    if (sort === 'latest') sorted.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'deadline') sorted.sort((a, b) => a.deadline - b.deadline);
    if (sort === 'reward') sorted.sort((a, b) => b.reward - a.reward || a.deadline - b.deadline);
    if (sort === 'distance') sorted.sort((a, b) => distanceMeters(spot, a.from) - distanceMeters(spot, b.from) || a.deadline - b.deadline);
    return sorted;
  }, [openTasks, category, keyword, sort, scene, spot, now, me.id]);

  const othersOpen = openTasks.filter((t) => t.publisherId !== me.id);
  const totalReward = othersOpen.reduce((s, t) => s + t.reward, 0);
  const sceneCount = (sc: Scene, at = spot) => othersOpen.filter((t) => matchScene(t, sc, at, now)).length;
  const spotLoc = findLocation(spot);
  const whereText = spotLoc?.area === '校门' || !spotLoc ? spot : `${spotLoc.area}`;

  const scenes = [
    { key: 'along' as const, label: '顺路帮一下', icon: Compass, count: sceneCount('along'), active: scene === 'along' },
    { key: 'nearest' as const, label: '离你最近', icon: Navigation, count: null, active: sort === 'distance' },
    { key: 'urgent' as const, label: '急单', icon: Zap, count: sceneCount('urgent'), active: scene === 'urgent' },
    { key: 'afterClass' as const, label: '下课顺路', icon: Backpack, count: sceneCount('afterClass'), active: scene === 'afterClass' },
  ];

  const toggleScene = (key: (typeof scenes)[number]['key']) => {
    if (key === 'nearest') return setSort(sort === 'distance' ? 'latest' : 'distance');
    setScene(scene === key ? 'all' : key);
  };

  const showAlong = () => {
    setScene('along');
    setCategory('all');
    setKeyword('');
    scrollWithinPage(listRef.current, 'start');
  };

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
          <button className="hero-kicker loc-switch" onClick={() => setPicking(true)}>
            <MapPin size={13} />
            你目前在{whereText}附近 · {spot}
            <span className="switch">切换</span>
          </button>
          <h2>
            发现<b className="num">{sceneCount('along')}</b>个顺路任务
          </h2>
          <div className="hero-row">
            <div className="hero-stats">
              <div>
                <b className="num">{othersOpen.length}</b>位同学需要帮忙
              </div>
              <div>
                <b className="num">¥{totalReward}</b>待领取奖励
              </div>
            </div>
            <button className="btn" onClick={showAlong}>
              看看顺路的
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

        <div className="scene-row" role="group" aria-label="校园场景">
          {scenes.map((sc) => {
            const Icon = sc.icon;
            return (
              <button key={sc.key} className={`scene-chip scene-${sc.key}${sc.active ? ' active' : ''}`} aria-pressed={sc.active} onClick={() => toggleScene(sc.key)}>
                <Icon size={15} />
                {sc.label}
                {sc.count !== null && <span className="num">{sc.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-bar" ref={listRef}>
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
                <TaskCard key={t.id} task={t} near={spot} />
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
            title={keyword ? `没有找到「${keyword}」相关的任务` : scene === 'along' ? `${spot}附近暂时没有顺路任务` : '这里暂时没有任务'}
            desc={scene === 'along' ? '换个位置看看，或者去看看全部任务' : '换个分类看看，或者发布你自己的需求'}
            action={
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setKeyword('');
                  setCategory('all');
                  setScene('all');
                }}
              >
                查看全部任务
              </button>
            }
          />
        )}
      </div>

      {picking && (
        <Sheet title="你现在在哪？" onClose={() => setPicking(false)}>
          <p className="sheet-desc">演示用，不获取真实定位。选择后会按这里计算距离和顺路任务。</p>
          <div className="spot-list">
            {MY_SPOTS.map((name) => (
              <button
                key={name}
                className={`spot${name === spot ? ' active' : ''}`}
                onClick={() => {
                  setSpot(name);
                  setPicking(false);
                  toast(`已切换到「${name}」附近，发现 ${sceneCount('along', name)} 个顺路任务`, 'info');
                }}
              >
                <MapPin size={16} />
                <span>
                  <strong>{name}</strong>
                  <small>
                    {findLocation(name)?.area} · 附近 {sceneCount('along', name)} 个顺路任务
                  </small>
                </span>
                {name === spot && <Check size={18} />}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </Page>
  );
}
