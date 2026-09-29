import { Inbox } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Layout';
import { MineTaskCard } from '../components/TaskCard';
import { Empty } from '../components/ui';
import { useStore } from '../store/AppStore';
import { isActive, nextStepFor } from '../store/logic';
import type { Task } from '../types';
import { useSessionState } from '../utils/useSessionState';

type Tab = 'active' | 'published' | 'running' | 'completed';

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: '进行中' },
  { key: 'published', label: '我发布的' },
  { key: 'running', label: '我接的' },
  { key: 'completed', label: '已完成' },
];

const EMPTY: Record<Tab, { title: string; desc: string; cta: string; to: string }> = {
  active: { title: '没有进行中的任务', desc: '接下或发布的任务开始后会出现在这里', cta: '去任务广场', to: '/' },
  published: { title: '还没有发布过任务', desc: '快递、带饭、打印……需要帮忙时，发个任务试试', cta: '发布任务', to: '/publish' },
  running: { title: '还没有接过任务', desc: '去广场看看有没有顺路的，帮同学一把', cta: '去任务广场', to: '/' },
  completed: { title: '还没有已完成的任务', desc: '完成的任务和评价会记录在这里', cta: '去任务广场', to: '/' },
};

export function MyTasks() {
  const { state, now } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useSessionState<Tab>('my.tab', 'active');
  const meId = state.meId;

  // 与首页、详情页使用同一份 state.tasks，只是按不同维度筛选
  const groups = useMemo(() => {
    const related = state.tasks.filter((t) => t.publisherId === meId || t.runnerId === meId);
    return {
      active: related.filter(isActive),
      published: related.filter((t) => t.publisherId === meId),
      running: related.filter((t) => t.runnerId === meId),
      completed: related.filter((t) => t.status === 'completed'),
    } satisfies Record<Tab, Task[]>;
  }, [state.tasks, meId]);

  const urgent = (t: Task) => (nextStepFor(t, meId, now)?.urgent ? 1 : 0);
  const hasTodo = (list: Task[]) => list.some((t) => urgent(t));

  // 需要我处理的排最前，其余按发布时间倒序
  const list = [...groups[tab]].sort((a, b) => urgent(b) - urgent(a) || b.createdAt - a.createdAt);
  const empty = EMPTY[tab];

  return (
    <Page tabbar>
      <div className="page-title">
        <h1>我的任务</h1>
        <p>我发布的求助和我接下的跑腿，都在这里</p>
      </div>

      <div className="my-filters">
        <div className="segmented four" role="tablist" aria-label="任务分组">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="count num">{groups[t.key].length}</span>
              {t.key !== 'completed' && hasTodo(groups[t.key]) && <span className="tab-dot" aria-label="有待处理" />}
            </button>
          ))}
        </div>
      </div>

      <div className="page-pad">
        {list.length > 0 ? (
          <div className="task-list">
            {list.map((t) => (
              <MineTaskCard key={t.id} task={t} showRole={tab === 'active' || tab === 'completed'} />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Inbox size={28} />}
            title={empty.title}
            desc={empty.desc}
            action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate(empty.to)}>
                {empty.cta}
              </button>
            }
          />
        )}
      </div>
    </Page>
  );
}
