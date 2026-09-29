import { FileQuestion, MessageCircle, Phone, SendHorizontal, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavBar, Page } from '../components/Layout';
import { Avatar, Empty, StatusTag, TypeIcon } from '../components/ui';
import { useStore } from '../store/AppStore';
import { displayStatus, newMessageId, roleOf } from '../store/logic';
import type { Task, TaskType, User } from '../types';
import { dayClock, MINUTE } from '../utils/time';
import { scrollWithinPage } from '../utils/scroll';

const NOUN: Record<TaskType, string> = {
  express: '快递',
  meal: '餐品',
  deliver: '物品',
  print: '资料',
  errand: '物品',
  other: '物品',
};

const QUICK_REPLIES = {
  runner: ['我到了', '已经取到了', '预计 5 分钟到', '收到，谢谢'],
  publisher: ['收到，谢谢', '我马上下楼', '放快递架就好', '辛苦啦～'],
};

/** 演示：对方根据你的消息给出简单回复 */
function autoReply(text: string, counterpartIsRunner: boolean) {
  const has = (...keys: string[]) => keys.some((k) => text.includes(k));
  if (counterpartIsRunner) {
    if (has('谢谢', '辛苦')) return '不客气～顺路的事';
    if (has('下楼')) return '好的，我在楼下门口等你';
    if (has('快递架', '放')) return '好的，放好了拍照给你';
    return '收到～';
  }
  if (has('到了')) return '好的，我马上下来！';
  if (has('取到')) return '太好了，谢谢！路上注意安全';
  if (has('分钟')) return '好的，不着急～';
  if (has('谢谢')) return '不客气，也谢谢你～';
  return '好的，收到';
}

type Item = { kind: 'msg'; id: string; from: string; text: string; at: number } | { kind: 'system'; id: string; text: string; at: number };

/** 系统消息由任务时间线派生：放弃过的任务只取最近一次接单之后的进度 */
function systemItems(task: Task, runner: User | null, meId: string): Item[] {
  const lastAbandon = task.timeline.map((e) => e.kind).lastIndexOf('abandoned');
  const events = task.timeline.slice(lastAbandon + 1);
  // 我是跑腿者时用「你」，避免用第三人称称呼自己
  const who = runner?.id === meId ? '你' : '跑腿者';
  const texts: Partial<Record<string, string>> = {
    accepted: runner?.id === meId ? '你接下了任务，可以和发布者沟通了' : `${runner?.name ?? '跑腿同学'}接下了任务，可以开始沟通了`,
    started: `${who}已出发，正在前往${task.from}`,
    picked: `${who}已取到${NOUN[task.type]}`,
    delivered: `${who}已送达${task.to}`,
    completed: '任务已完成，感谢这次互助',
  };
  return events
    .filter((e) => texts[e.kind])
    .map((e, i) => ({ kind: 'system' as const, id: `sys-${e.kind}-${i}`, text: texts[e.kind]!, at: e.at }));
}

export function Chat() {
  const { id } = useParams();
  const { state, me, now, run, toast } = useStore();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const task = state.tasks.find((t) => t.id === id);
  const runner = task?.runnerId ? state.users[task.runnerId] : null;

  const items = useMemo<Item[]>(() => {
    if (!task) return [];
    const msgs: Item[] = (state.messages[task.id] ?? []).map((m) => ({ kind: 'msg', ...m }));
    return [...msgs, ...systemItems(task, runner, me.id)].sort((a, b) => a.at - b.at);
  }, [task, runner, state.messages, me.id]);

  useEffect(() => {
    scrollWithinPage(bottomRef.current, 'end', false);
  }, [items.length, typing]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  if (!task) {
    return (
      <Page header={<NavBar title="任务沟通" />}>
        <Empty icon={<FileQuestion size={28} />} title="任务不存在或已被删除" action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/', { replace: true })}>回到任务广场</button>} />
      </Page>
    );
  }

  const role = roleOf(task, me.id);
  if (role === 'visitor' || !runner) {
    return (
      <Page header={<NavBar title="任务沟通" />}>
        <Empty
          icon={<MessageCircle size={28} />}
          title="接单后才能与对方沟通"
          desc="为了保护双方隐私，聊天只在任务双方之间开放"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/task/${task.id}`, { replace: true })}>
              查看任务详情
            </button>
          }
        />
      </Page>
    );
  }

  const counterpart = role === 'publisher' ? runner : state.users[task.publisherId];
  const status = displayStatus(task, now);
  const lastMine = [...items].reverse().find((i) => i.kind === 'msg' && i.from === me.id);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (!run({ type: 'sendMessage', taskId: task.id, id: newMessageId(), text })) return;
    setInput('');
    // 演示：对方「正在输入」后回复；连续发送时只保留最后一次回复
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [
      window.setTimeout(() => setTyping(true), 600),
      window.setTimeout(() => {
        setTyping(false);
        run({ type: 'receiveMessage', taskId: task.id, id: newMessageId(), text: autoReply(text, role === 'publisher') });
      }, 1800),
    ];
  };

  return (
    <Page
      header={
        <NavBar
          title={counterpart.name}
          bordered
          right={
            <button className="icon-btn" aria-label="拨打隐私号" onClick={() => toast('已为双方生成隐私号 170****3321（演示）', 'info')}>
              <Phone size={19} />
            </button>
          }
        />
      }
      footer={
        <div className="chat-footer">
          <div className="quick-replies">
            {QUICK_REPLIES[role].map((q) => (
              <button key={q} className="chip" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input value={input} maxLength={200} placeholder={`发消息给${counterpart.name}`} onChange={(e) => setInput(e.target.value)} aria-label="输入消息" />
            <button type="submit" className="send-btn" disabled={!input.trim()} aria-label="发送">
              <SendHorizontal size={18} />
            </button>
          </form>
        </div>
      }
    >
      <button className="chat-task" onClick={() => navigate(`/task/${task.id}`)}>
        <TypeIcon type={task.type} size={36} />
        <span className="ct-main">
          <strong>{task.title}</strong>
          <span>
            {task.from} → {task.to}
          </span>
        </span>
        <span className="ct-side">
          <StatusTag status={status} />
          <b className="num">¥{task.reward}</b>
        </span>
      </button>

      <div className="chat-body">
        <div className="chat-safety">
          <ShieldCheck size={13} />
          双方均为同校认证学生 · 平台不会索要转账或验证码
        </div>

        {items.map((it, i) => {
          const prev = items[i - 1];
          const showTime = !prev || it.at - prev.at > 5 * MINUTE;
          return (
            <div key={it.id}>
              {showTime && <div className="chat-time num">{dayClock(it.at, now)}</div>}
              {it.kind === 'system' ? (
                <div className="chat-system">{it.text}</div>
              ) : (
                <div className={`bubble-row${it.from === me.id ? ' mine' : ''}`}>
                  {it.from !== me.id && <Avatar user={state.users[it.from]} size={32} />}
                  <div className="bubble">{it.text}</div>
                </div>
              )}
              {lastMine && it.id === lastMine.id && <div className="bubble-status">已送达</div>}
            </div>
          );
        })}

        {typing && (
          <div className="bubble-row">
            <Avatar user={counterpart} size={32} />
            <div className="bubble typing" aria-label="对方正在输入">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </Page>
  );
}
