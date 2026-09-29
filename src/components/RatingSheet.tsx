import { Star } from 'lucide-react';
import { useState } from 'react';
import type { User } from '../types';
import { Avatar, Sheet } from './ui';

const LABELS = ['', '很不满意', '不太满意', '一般', '满意', '非常满意'];

/** 评价跑腿同学 / 评价发布者 的标签不同 */
const TAGS = {
  runner: ['准时送达', '物品完好', '沟通顺畅', '态度友好', '超出预期'],
  publisher: ['描述清晰', '确认及时', '沟通顺畅', '态度友好', '报酬爽快'],
};

interface Props {
  target: User;
  targetRole: 'runner' | 'publisher';
  taskTitle: string;
  onClose: () => void;
  onSubmit: (r: { score: number; tags: string[]; comment: string }) => void;
}

export function RatingSheet({ target, targetRole, taskTitle, onClose, onSubmit }: Props) {
  const [score, setScore] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const toggle = (t: string) => setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));

  return (
    <Sheet title={targetRole === 'runner' ? '评价跑腿同学' : '评价发布者'} onClose={onClose}>
      <div className="rate-target">
        <Avatar user={target} size={36} showCheck />
        <div>
          <div className="t-name">{target.name}</div>
          <div className="t-sub">任务：{taskTitle}</div>
        </div>
      </div>

      <div className="star-input" role="radiogroup" aria-label="评分">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={score === i}
            aria-label={`${i} 星`}
            className={i <= score ? 'on' : ''}
            onClick={() => setScore(i)}
          >
            <Star size={34} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <div className="star-label">{LABELS[score]}</div>

      <div className="tag-picker">
        {TAGS[targetRole].map((t) => (
          <button key={t} type="button" className={`option${tags.includes(t) ? ' active' : ''}`} onClick={() => toggle(t)}>
            {t}
          </button>
        ))}
      </div>

      <textarea
        className="textarea"
        placeholder={score >= 4 ? '说说这次互助的感受吧（选填）' : '遇到了什么问题？你的反馈会帮助社区变得更好（选填）'}
        maxLength={100}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="field-foot">
        <span>评价会展示在对方的个人主页</span>
        <span className="num">{comment.length}/100</span>
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 16 }}
        onClick={() => onSubmit({ score, tags, comment: comment.trim() })}
      >
        提交评价
      </button>
    </Sheet>
  );
}
