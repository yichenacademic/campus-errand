import { ChevronRight, Clock, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { displayStatus, nextStepFor, roleOf } from '../store/logic';
import type { Task } from '../types';
import { dayClock, MINUTE, remaining, timeAgo } from '../utils/time';
import { Avatar, CreditLine, Route, StatusTag, TaskTags, TypeChip } from './ui';

/** 任务广场卡片 */
export function TaskCard({ task }: { task: Task }) {
  const { state, now } = useStore();
  const navigate = useNavigate();
  const publisher = state.users[task.publisherId];
  const isMine = task.publisherId === state.meId;
  const soon = task.deadline - now < 30 * MINUTE;

  return (
    <button className="task-card card" onClick={() => navigate(`/task/${task.id}`)}>
      <div className="tc-head">
        <TypeChip type={task.type} />
        <TaskTags tags={task.tags.slice(0, 2)} />
        <span className="spacer" />
        <span className="ago">{timeAgo(task.createdAt, now)}</span>
      </div>
      <div className="tc-main">
        <div className="tc-text">
          <h3 className="tc-title">{task.title}</h3>
          <Route from={task.from} to={task.to} />
        </div>
        <div className="reward num">
          <small>¥</small>
          {task.reward}
          <em>奖励</em>
        </div>
      </div>
      <div className="tc-meta">
        <span className={soon ? 'soon' : ''}>
          <Clock size={14} />
          希望 {dayClock(task.deadline, now)} 前送到
        </span>
        <span>
          <Timer size={14} />
          预计 {task.etaMinutes} 分钟
        </span>
      </div>
      <div className="tc-foot">
        <span className="who">
          <Avatar user={publisher} size={24} />
          <CreditLine user={publisher} />
        </span>
        {isMine ? <span className="mine-flag">我发布的</span> : <span className="next-step">{remaining(task.deadline, now)}</span>}
      </div>
    </button>
  );
}

/** 我的任务卡片：突出状态和「下一步」 */
export function MineTaskCard({ task }: { task: Task }) {
  const { state, now } = useStore();
  const navigate = useNavigate();
  const role = roleOf(task, state.meId);
  const counterpartId = role === 'publisher' ? task.runnerId : task.publisherId;
  const counterpart = counterpartId ? state.users[counterpartId] : null;
  const next = nextStepFor(task, state.meId, now);

  return (
    <button className="task-card card mine-card" onClick={() => navigate(`/task/${task.id}`)}>
      <div className="tc-head">
        <TypeChip type={task.type} />
        <span className="spacer" />
        <StatusTag status={displayStatus(task, now)} />
      </div>
      <div className="tc-main">
        <div className="tc-text">
          <h3 className="tc-title">{task.title}</h3>
          <Route from={task.from} to={task.to} />
        </div>
        <div className="reward num">
          <small>¥</small>
          {task.reward}
        </div>
      </div>
      <div className="tc-foot">
        <span className="counterpart">
          {counterpart ? (
            <>
              <Avatar user={counterpart} size={20} />
              {role === 'publisher' ? '跑腿：' : '发布者：'}
              {counterpart.name}
            </>
          ) : (
            <>{timeAgo(task.createdAt, now)}发布</>
          )}
        </span>
        {next && (
          <span className={`next-step${next.urgent ? ' urgent' : ''}`}>
            {next.text}
            <ChevronRight size={14} />
          </span>
        )}
      </div>
    </button>
  );
}
