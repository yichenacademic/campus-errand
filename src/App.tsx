import { Link, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui';
import { Chat } from './pages/Chat';
import { Home } from './pages/Home';
import { MyTasks } from './pages/MyTasks';
import { Profile } from './pages/Profile';
import { Publish } from './pages/Publish';
import { TaskDetail } from './pages/TaskDetail';
import { AppStoreProvider } from './store/AppStore';

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#16A06F" />
      <path d="M16 40c8 0 10-14 19-14h11" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="47" cy="26" r="5" fill="#fff" />
      <circle cx="16" cy="40" r="3" fill="#8FF0C4" />
    </svg>
  );
}

const GUIDE = [
  { to: '/', title: '看看身边的顺路任务', desc: '切换位置 → 顺路帮一下 / 急单 / 下课顺路' },
  { to: '/chat/m7', title: '任务内沟通', desc: '预置聊天、快捷回复、系统进度消息' },
  { to: '/task/m4', title: '跑腿推进状态', desc: '开始任务 → 已取到 → 已送达 → 完成' },
  { to: '/task/m2', title: '确认收到并互评', desc: '1–5 星 + 快捷标签，查看信用变化' },
  { to: '/me', title: '查看校园信用', desc: '信用等级、加分来源与扣分行为' },
];

function Aside() {
  return (
    <aside className="aside">
      <div className="aside-brand">
        <Logo />
        <div>
          <strong>顺路</strong>
          <span>校园跑腿互助平台</span>
        </div>
      </div>
      <h2>
        顺路帮个忙，
        <br />
        让<em>校园</em>更近一点
      </h2>
      <p>把散落在微信群里的跑腿需求集中起来：发布任务 → 同校同学接单 → 完成跑腿 → 双方评价 → 积累校园信用。</p>
      <div className="guide">
        <div className="guide-title">演示路线</div>
        <ol>
          {GUIDE.map((g, i) => (
            <li key={g.to}>
              <Link to={g.to}>
                <b>{i + 1}</b>
                <div>
                  <strong>{g.title}</strong>
                  <span>{g.desc}</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <p className="aside-foot">当前身份：陈同学（Demo 用户）· 数据保存在本地浏览器，可在「我的」中重置</p>
    </aside>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppStoreProvider>
        <div className="shell">
          <Aside />
          <div className="frame">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/publish" element={<Publish />} />
              <Route path="/task/:id" element={<TaskDetail />} />
              <Route path="/chat/:id" element={<Chat />} />
              <Route path="/my-tasks" element={<MyTasks />} />
              <Route path="/me" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
          </div>
        </div>
      </AppStoreProvider>
    </HashRouter>
  );
}
