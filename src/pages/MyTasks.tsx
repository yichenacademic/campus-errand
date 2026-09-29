import { Inbox } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Layout';
import { MineTaskCard } from '../components/TaskCard';
import { Empty } from '../components/ui';
import { useStore } from '../store/AppStore';
import { displayStatus, nextStepFor } from '../store/logic';
import type { Task } from '../types';
import { useSessionState } from '../utils/useSessionState';

type Side = 'published' | 'running';
type Filter = 'all' | 'todo' | 'ongoing' | 'done';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'todo', label: '待我处理' },
  { key: 'ongoing', label: '进行中' },
  { key: 'done', label: '已结束' },
];

export function MyTasks() {
  const { state, now } = useStore();
  const navigate = useNavigate();
  const [side, setSide] = useSessionState<Side>('my.side', 'published');
  const [filter, setFilter] = useSessionState<Filter>('my.filter', 'all');

  const published = useMemo(() => state.tasks.filter((t) => t.publisherId === state.meId), [state.tasks, state.meId]);
  const running = useMemo(() => state.tasks.filter((t) => t.runnerId === state.meId), [state.tasks, state.meId]);
  const source = side === 'published' ? published : running;

  const match = (t: Task, f: Filter) => {
    const s = displayStatus(t, now);
    if (f === 'todo') return Boolean(nextStepFor(t, state.meId, now)?.urgent);
    if (f === 'ongoing') return s === 'open' || s === 'accepted' || s === 'delivered';
    if (f === 'done') return s === 'completed' || s === 'cancelled' || s === 'expired';
    return true;
  };

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, source.filter((t) => match(t, f.key)).length])) as Record<Filter, number>;
  const todoCount = (list: Task[]) => list.filter((t) => match(t, 'todo')).length;

  // 需要我处理的排最前，其余按发布时间倒序
  const list = source
    .filter((t) => match(t, filter))
    .sort((a, b) => {
      const ua = nextStepFor(a, state.meId, now)?.urgent ? 1 : 0;
      const ub = nextStepFor(b, state.meId, now)?.urgent ? 1 : 0;
      return ub - ua || b.createdAt - a.createdAt;
    });

  return (
    <Page tabbar>
      <div className="page-title">
        <h1>我的任务</h1>
        <p>我发布的求助和我接下的跑腿，都在这里</p>
      </div>
      <div className="my-head">
        <div className="segmented" role="tablist">
          {(
            [
              ['published', '我发布的', published],
              ['running', '我接的', running],
            ] as const
          ).map(([key, label, arr]) => (
            <button key={key} role="tab" aria-selected={side === key} className={side === key ? 'active' : ''} onClick={() => setSide(key)}>
              {label}
              <span className="count num">{arr.length}</span>
              {todoCount(arr) > 0 && <span className="tab-dot" aria-label="有待处理" />}
            </button>
          ))}
        </div>
      </div>

      <div className="my-filters">
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
              <span className="count num">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="page-pad">
        {list.length > 0 ? (
          <div className="task-list">
            {list.map((t) => (
              <MineTaskCard key={t.id} task={t} />
            ))}
          </div>
        ) : source.length === 0 ? (
          side === 'published' ? (
            <Empty
              icon={<Inbox size={28} />}
              title="还没有发布过任务"
              desc="快递、带饭、打印……需要帮忙时，发个任务试试"
              action={
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/publish')}>
                  发布任务
                </button>
              }
            />
          ) : (
            <Empty
              icon={<Inbox size={28} />}
              title="还没有接过任务"
              desc="去广场看看有没有顺路的，帮同学一把"
              action={
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>
                  去任务广场
                </button>
              }
            />
          )
        ) : (
          <Empty
            icon={<Inbox size={28} />}
            title={filter === 'todo' ? '没有需要你处理的任务' : '这里暂时是空的'}
            desc={filter === 'todo' ? '都处理完啦，休息一下吧' : '换个筛选条件看看'}
            action={
              <button className="btn btn-secondary btn-sm" onClick={() => setFilter('all')}>
                查看全部
              </button>
            }
          />
        )}
      </div>
    </Page>
  );
}
