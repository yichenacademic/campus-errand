import { ArrowRight, BadgeCheck, Check, CircleAlert, Info, Star } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { TASK_TYPE_MAP } from '../data/taskTypes';
import { STATUS_META, type DisplayStatus } from '../store/logic';
import { useStore } from '../store/AppStore';
import type { TaskType, User } from '../types';

export function Avatar({ user, size = 32, showCheck = false }: { user: User; size?: number; showCheck?: boolean }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: user.color, fontSize: Math.round(size * 0.44) }}
      aria-hidden
    >
      {user.surname}
      {showCheck && user.verified && (
        <span className="avatar-check" style={{ width: size * 0.4, height: size * 0.4 }}>
          <BadgeCheck size={size * 0.38} strokeWidth={2.4} />
        </span>
      )}
    </span>
  );
}

export function TypeIcon({ type, size = 40 }: { type: TaskType; size?: number }) {
  const meta = TASK_TYPE_MAP[type];
  const Icon = meta.icon;
  return (
    <span className="type-icon" style={{ width: size, height: size, background: meta.tint, color: meta.color, borderRadius: size * 0.3 }}>
      <Icon size={size * 0.5} strokeWidth={2} />
    </span>
  );
}

export function TypeChip({ type }: { type: TaskType }) {
  const meta = TASK_TYPE_MAP[type];
  const Icon = meta.icon;
  return (
    <span className="type-chip" style={{ background: meta.tint, color: meta.color }}>
      <Icon size={14} strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}

export function StatusTag({ status }: { status: DisplayStatus }) {
  const meta = STATUS_META[status];
  return <span className={`status-tag tone-${meta.tone}`}>{meta.label}</span>;
}

export function TaskTags({ tags }: { tags: string[] }) {
  return (
    <>
      {tags.map((t) => (
        <span key={t} className={`tag${t === '急' ? ' urgent' : ''}`}>
          {t}
        </span>
      ))}
    </>
  );
}

export function Route({ from, to }: { from: string; to: string }) {
  return (
    <div className="route">
      <span className="place">
        <i className="pin" />
        <span>{from}</span>
      </span>
      <ArrowRight className="arrow" size={14} />
      <span className="place">
        <i className="pin to" />
        <span>{to}</span>
      </span>
    </div>
  );
}

/** 林同学 · 信用分 96 · 已认证 */
export function CreditLine({ user, prefix }: { user: User; prefix?: string }) {
  return (
    <span className="credit-line">
      <span className="name">
        {prefix}
        {user.name}
      </span>
      <span className="dot">·</span>
      <span className="score">
        信用分 <b className="num">{user.credit}</b>
      </span>
      <span className="dot">·</span>
      {user.verified ? (
        <span className="verified">
          <BadgeCheck size={13} strokeWidth={2.4} />
          已认证
        </span>
      ) : (
        <span className="unverified">未认证</span>
      )}
    </span>
  );
}

export function Stars({ score, size = 14 }: { score: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${score} 星`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= score ? '' : 'off'} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {action}
    </div>
  );
}

export function Toaster() {
  const { toasts } = useStore();
  return (
    <div className="toast-layer" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'success' ? <Check size={16} strokeWidth={3} /> : t.tone === 'error' ? <CircleAlert size={16} /> : <Info size={16} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

export interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmText: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div className="overlay center" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={options.title} onClick={(e) => e.stopPropagation()}>
        <h3>{options.title}</h3>
        <div className="dialog-body">{options.body}</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary btn-block" onClick={onClose}>
            {options.cancelText ?? '再想想'}
          </button>
          <button
            className="btn btn-primary btn-block"
            style={options.danger ? { background: 'var(--red)', boxShadow: 'none' } : undefined}
            onClick={() => {
              onClose();
              options.onConfirm();
            }}
          >
            {options.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="overlay bottom" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export function creditTone(score: number): '' | 'mid' | 'low' {
  if (score >= 90) return '';
  if (score >= 80) return 'mid';
  return 'low';
}
