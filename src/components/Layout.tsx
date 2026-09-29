import { ChevronLeft, ClipboardList, House, Plus, UserRound } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { nextStepFor } from '../store/logic';

/** 每条历史记录各自记住滚动位置：返回时恢复，新进入时回到顶部 */
const scrollMemory = new Map<string, number>();

interface PageProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  tabbar?: boolean;
}

export function Page({ children, header, footer, tabbar }: PageProps) {
  const bodyRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = navType === 'POP' ? (scrollMemory.get(location.key) ?? 0) : 0;
  }, [location.key, navType]);

  return (
    <div className="page">
      {header}
      <main
        className="page-body"
        ref={bodyRef}
        onScroll={(e) => scrollMemory.set(location.key, e.currentTarget.scrollTop)}
      >
        {children}
      </main>
      {footer}
      {tabbar && <TabBar />}
    </div>
  );
}

export function NavBar({ title, right, bordered, onBack }: { title: string; right?: ReactNode; bordered?: boolean; onBack?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const back = () => {
    if (onBack) return onBack();
    // 直接打开详情链接时没有上一页，回到广场
    if (location.key === 'default') navigate('/', { replace: true });
    else navigate(-1);
  };
  return (
    <header className={`navbar${bordered ? ' bordered' : ''}`}>
      <button className="icon-btn" onClick={back} aria-label="返回">
        <ChevronLeft size={24} />
      </button>
      <h1>{title}</h1>
      <div>{right}</div>
    </header>
  );
}

function TabBar() {
  const { state, now } = useStore();
  const pending = state.tasks.filter((t) => nextStepFor(t, state.meId, now)?.urgent).length;

  return (
    <nav className="tabbar" aria-label="主导航">
      <NavLink to="/" end className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <House size={22} />
        广场
      </NavLink>
      <NavLink to="/publish" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <span className="tab-publish">
          <Plus size={18} strokeWidth={2.6} />
        </span>
        发布
      </NavLink>
      <NavLink to="/my-tasks" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <ClipboardList size={22} />
        我的任务
        {pending > 0 && <span className="tab-badge num">{pending}</span>}
      </NavLink>
      <NavLink to="/me" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
        <UserRound size={22} />
        我的
      </NavLink>
    </nav>
  );
}
