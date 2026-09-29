import type { AppState, CreditLog, PastReview, Rating, Task, TaskType, TimelineEvent, User } from '../types';
import { DAY, HOUR, MINUTE, roundUpTo10 } from '../utils/time';

export const STATE_VERSION = 3;
export const ME_ID = 'u_me';

const u = (
  id: string,
  surname: string,
  color: string,
  college: string,
  grade: string,
  credit: number,
  runCount: number,
  publishCount: number,
  goodRate: number,
  onTimeRate: number,
  verified = true,
): User => ({
  id,
  surname,
  name: `${surname}同学`,
  color,
  college,
  grade,
  verified,
  credit,
  runCount,
  publishCount,
  goodRate,
  onTimeRate,
});

const USERS: User[] = [
  u(ME_ID, '陈', '#19A071', '计算机学院', '研一', 92, 23, 11, 98, 96),
  u('u_lin', '林', '#E0803A', '材料学院', '研二', 96, 41, 18, 99, 98),
  u('u_zhou', '周', '#3F7FD9', '经济管理学院', '大三', 88, 12, 20, 95, 92),
  u('u_wang', '王', '#7C5CD6', '土木工程学院', '大二', 94, 30, 9, 98, 97),
  u('u_zhao', '赵', '#D65C8A', '外国语学院', '大四', 91, 17, 14, 97, 95),
  u('u_sun', '孙', '#6B8E23', '机械工程学院', '大一', 80, 0, 2, 100, 100, false),
  u('u_wu', '吴', '#2C9CB0', '医学院', '研一', 93, 22, 16, 98, 96),
  u('u_zheng', '郑', '#C9772B', '数学学院', '大三', 89, 9, 13, 96, 93),
  u('u_he', '何', '#D9534F', '艺术学院', '大二', 97, 52, 7, 100, 99),
  u('u_xu', '许', '#4F6BD8', '化学学院', '研三', 90, 15, 25, 96, 94),
  u('u_gao', '高', '#8E6CC2', '法学院', '大一', 85, 3, 5, 100, 95),
  u('u_ma', '马', '#2E8B57', '体育学院', '大三', 95, 64, 4, 99, 98),
  u('u_liu', '刘', '#DB7A3C', '新闻传播学院', '大二', 92, 28, 6, 98, 96),
  u('u_yang', '杨', '#5B8DEF', '生命科学学院', '研二', 87, 6, 19, 94, 91),
];

interface TaskSeed {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  privateNote?: string;
  from: string;
  to: string;
  reward: number;
  eta: number;
  /** 发布于多少分钟前 */
  ago: number;
  /** 截止时间在发布后多少分钟 */
  window: number;
  tags?: string[];
  publisher: string;
}

// 任务广场：其他同学发布的待接单任务
const PLAZA: TaskSeed[] = [
  {
    id: 't01', type: 'express', title: '帮取菜鸟驿站快递', publisher: 'u_lin',
    from: '菜鸟驿站', to: '研究生宿舍 3 号楼', reward: 6, eta: 12, ago: 8, window: 60,
    description: '中通小件，大概一个鞋盒大小，不重。放宿舍楼下的快递架上就行，谢谢～',
    privateNote: '取件码 5-2-1043，收件手机尾号 6628', tags: ['小件'],
  },
  {
    id: 't02', type: 'meal', title: '二食堂顺路带份麻辣香锅', publisher: 'u_zhou',
    from: '二食堂', to: '教学楼 A 区', reward: 5, eta: 15, ago: 3, window: 45,
    description: '二楼香锅窗口，土豆片+藕片+午餐肉，微辣。饭钱见面当场转你，下午连着实验课实在走不开。',
    privateNote: 'A 区 305 教室，从后门进来第二排', tags: ['饭钱另付'],
  },
  {
    id: 't03', type: 'deliver', title: '从图书馆带资料到宿舍', publisher: 'u_wu',
    from: '图书馆', to: '研究生宿舍 5 号楼', reward: 8, eta: 18, ago: 21, window: 110,
    description: '图书馆三楼北区自习室 312 座位上有两本教材和一个蓝色文件袋，帮我带回宿舍，座位已经跟管理员说过了。',
    privateNote: '5 号楼 402，门口收纳箱可以直接放', tags: ['需上楼'],
  },
  {
    id: 't04', type: 'print', title: '帮忙打印下午的课程讲义', publisher: 'u_zhao',
    from: '文印中心', to: '教学楼 B 区', reward: 7, eta: 16, ago: 15, window: 85,
    description: '约 40 页，黑白双面，左侧订一下。打印费按文印中心价格另付，大概 6 元。',
    privateNote: '文件已传到文印中心自助机，取件码 8812', tags: ['约 40 页', '打印费另付'],
  },
  {
    id: 't05', type: 'deliver', title: '急！帮送钥匙到宿舍楼下', publisher: 'u_he',
    from: '体育馆', to: '本科生宿舍 7 号楼', reward: 5, eta: 10, ago: 2, window: 30,
    description: '室友被锁在门外了，钥匙寄存在体育馆一楼前台，报我名字就能拿。',
    privateNote: '室友电话 138****2046，在 7 号楼门口等', tags: ['急', '小件'],
  },
  {
    id: 't06', type: 'takeout', title: '帮取外卖送到 5 楼', publisher: 'u_zheng',
    from: '东门', to: '研究生宿舍 5 号楼', reward: 3, eta: 8, ago: 5, window: 35,
    description: '外卖已经到东门外卖柜，一份粥，送到 5 楼楼梯口就好。',
    privateNote: '外卖柜 12 号格，取餐码 3391', tags: ['需上楼'],
  },
  {
    id: 't07', type: 'express', title: '帮取京东大件快递', publisher: 'u_ma',
    from: '京东快递点', to: '本科生宿舍 12 号楼', reward: 10, eta: 22, ago: 34, window: 150,
    description: '一箱矿泉水加一个收纳箱，有点重，有自行车或小推车会轻松很多。',
    privateNote: '取件码 JD-7730，收件手机尾号 0915', tags: ['大件', '约 12kg'],
  },
  {
    id: 't08', type: 'meal', title: '一食堂带两个煎饼果子', publisher: 'u_sun',
    from: '一食堂', to: '图书馆', reward: 4, eta: 12, ago: 11, window: 50,
    description: '一楼门口煎饼摊，两个都加蛋加脆，其中一个不要葱。饭钱另外转你。',
    privateNote: '图书馆二楼 A 区 218 座', tags: ['饭钱另付'],
  },
  {
    id: 't09', type: 'errand', title: '帮忙去行政楼交奖学金材料', publisher: 'u_xu',
    from: '研究生宿舍 3 号楼', to: '行政楼', reward: 8, eta: 20, ago: 40, window: 190,
    description: '奖学金申请表已经签好字，交到行政楼 204 学生资助中心即可。材料放在宿舍楼下快递架。',
    privateNote: '3 号楼一楼快递架最上层，牛皮纸袋写着「许」', tags: ['可能排队'],
  },
  {
    id: 't10', type: 'print', title: '帮取打印好的社团海报', publisher: 'u_gao',
    from: '文印中心', to: '大学生活动中心', reward: 6, eta: 10, ago: 18, window: 100,
    description: '两张 A1 的 KT 板海报，已经付过钱了。请竖着拿，别折到边角。',
    privateNote: '取件报「法学院辩论队」', tags: ['易折损'],
  },
  {
    id: 't11', type: 'takeout', title: '帮取奶茶送到实验楼', publisher: 'u_yang',
    from: '西门', to: '实验楼', reward: 4, eta: 18, ago: 6, window: 40,
    description: '两杯奶茶在西门外卖架上，在做细胞培养走不开，辛苦啦～',
    privateNote: '实验楼 5 楼 512，敲门就好',
  },
  {
    id: 't12', type: 'errand', title: '帮还两本图书馆的书', publisher: 'u_wang',
    from: '本科生宿舍 12 号楼', to: '图书馆', reward: 4, eta: 14, ago: 26, window: 210,
    description: '两本书今天到期，放在宿舍楼下快递架，帮我放进图书馆一楼的自助还书机就可以。',
    privateNote: '12 号楼快递架，袋子上写着「王」', tags: ['不赶时间'],
  },
];

function rating(score: number, tags: string[], comment: string, at: number): Rating {
  return { score, tags, comment, at };
}

function buildTask(s: TaskSeed, now: number): Task {
  const createdAt = now - s.ago * MINUTE;
  const publisher = USERS.find((x) => x.id === s.publisher)!;
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    description: s.description,
    privateNote: s.privateNote ?? '',
    from: s.from,
    to: s.to,
    reward: s.reward,
    etaMinutes: s.eta,
    createdAt,
    deadline: roundUpTo10(createdAt + s.window * MINUTE),
    tags: s.tags ?? [],
    publisherId: s.publisher,
    runnerId: null,
    status: 'open',
    timeline: [{ kind: 'published', at: createdAt, text: `${publisher.name}发布了任务` }],
    ratingByPublisher: null,
    ratingByRunner: null,
  };
}

function ev(kind: TimelineEvent['kind'], at: number, text: string): TimelineEvent {
  return { kind, at, text };
}

// 「我的任务」里的历史与进行中数据，覆盖每一种状态，方便演示完整流程
function myTasks(now: number): Task[] {
  const base = {
    tags: [] as string[],
    ratingByPublisher: null as Rating | null,
    ratingByRunner: null as Rating | null,
  };

  const m1Created = now - 25 * MINUTE;
  const m2Created = now - 70 * MINUTE;
  const m3Created = now - 4 * MINUTE;
  const m4Created = now - 22 * MINUTE;
  const m5Created = now - DAY - 3 * HOUR;
  const m6Created = now - DAY - 5 * HOUR;

  return [
    {
      ...base,
      id: 'm1', type: 'express', title: '帮取顺丰快递', publisherId: ME_ID, runnerId: 'u_liu', status: 'accepted',
      from: '菜鸟驿站', to: '研究生宿舍 3 号楼', reward: 6, etaMinutes: 12,
      description: '一个文件袋，很轻。放 3 号楼门口快递架就好。',
      privateNote: '取件码 3-1-2208，手机尾号 4417', tags: ['小件'],
      createdAt: m1Created, deadline: roundUpTo10(m1Created + 60 * MINUTE),
      timeline: [
        ev('published', m1Created, '陈同学发布了任务'),
        ev('accepted', m1Created + 7 * MINUTE, '刘同学接下了任务，正在前往菜鸟驿站'),
      ],
    },
    {
      ...base,
      id: 'm2', type: 'print', title: '帮打印组会要用的论文', publisherId: ME_ID, runnerId: 'u_ma', status: 'delivered',
      from: '文印中心', to: '实验楼', reward: 7, etaMinutes: 14,
      description: '3 篇论文共 36 页，黑白单面，每篇分别订好。打印费我另外转。',
      privateNote: '文印中心自助机取件码 5520；实验楼 4 楼 406',
      createdAt: m2Created, deadline: roundUpTo10(m2Created + 90 * MINUTE),
      timeline: [
        ev('published', m2Created, '陈同学发布了任务'),
        ev('accepted', m2Created + 9 * MINUTE, '马同学接下了任务'),
        ev('delivered', now - 6 * MINUTE, '马同学已送达，等待你确认完成'),
      ],
    },
    {
      ...base,
      id: 'm3', type: 'meal', title: '二食堂带一份黄焖鸡米饭', publisherId: ME_ID, runnerId: null, status: 'open',
      from: '二食堂', to: '研究生宿舍 3 号楼', reward: 5, etaMinutes: 16,
      description: '一楼黄焖鸡窗口，中份，加一份土豆。饭钱见面转。',
      privateNote: '3 号楼 612，到楼下给我发消息', tags: ['饭钱另付'],
      createdAt: m3Created, deadline: roundUpTo10(m3Created + 50 * MINUTE),
      timeline: [ev('published', m3Created, '陈同学发布了任务')],
    },
    {
      ...base,
      id: 'm4', type: 'deliver', title: '帮送 U 盘到教学楼 B 区', publisherId: 'u_zhao', runnerId: ME_ID, status: 'accepted',
      from: '图书馆', to: '教学楼 B 区', reward: 5, etaMinutes: 10,
      description: 'U 盘在图书馆一楼服务台，写着「赵」。下节课要用里面的课件。',
      privateNote: '送到 B 区 204 教室讲台，交给课代表即可',
      tags: ['急'],
      createdAt: m4Created, deadline: roundUpTo10(m4Created + 45 * MINUTE),
      timeline: [
        ev('published', m4Created, '赵同学发布了任务'),
        ev('accepted', m4Created + 6 * MINUTE, '你接下了任务'),
      ],
    },
    {
      ...base,
      id: 'm5', type: 'takeout', title: '帮取外卖送到宿舍', publisherId: ME_ID, runnerId: 'u_he', status: 'completed',
      from: '东门', to: '研究生宿舍 3 号楼', reward: 3, etaMinutes: 10,
      description: '东门外卖柜，一份砂锅粥。',
      privateNote: '外卖柜 7 号格',
      createdAt: m5Created, deadline: roundUpTo10(m5Created + 40 * MINUTE),
      timeline: [
        ev('published', m5Created, '陈同学发布了任务'),
        ev('accepted', m5Created + 3 * MINUTE, '何同学接下了任务'),
        ev('delivered', m5Created + 15 * MINUTE, '何同学已送达'),
        ev('completed', m5Created + 18 * MINUTE, '你确认完成，报酬 ¥3 已结算'),
        ev('rated', m5Created + 19 * MINUTE, '你评价了何同学'),
      ],
      ratingByPublisher: rating(5, ['准时送达', '态度友好'], '超快，粥还是热的！', m5Created + 19 * MINUTE),
      ratingByRunner: rating(5, ['描述清晰', '确认及时'], '', m5Created + 25 * MINUTE),
    },
    {
      ...base,
      id: 'm6', type: 'errand', title: '帮取学院发的专业教材', publisherId: 'u_wu', runnerId: ME_ID, status: 'completed',
      from: '行政楼', to: '研究生宿舍 5 号楼', reward: 8, etaMinutes: 18,
      description: '行政楼 1 楼学院办公室领取，报学号即可，一共 3 本。',
      privateNote: '学号 2025xxxx018；5 号楼 402',
      createdAt: m6Created, deadline: roundUpTo10(m6Created + 120 * MINUTE),
      timeline: [
        ev('published', m6Created, '吴同学发布了任务'),
        ev('accepted', m6Created + 12 * MINUTE, '你接下了任务'),
        ev('delivered', m6Created + 38 * MINUTE, '你已送达'),
        ev('completed', m6Created + 45 * MINUTE, '吴同学确认完成，报酬 ¥8 已结算'),
      ],
      ratingByPublisher: rating(5, ['准时送达', '物品完好'], '书一本没少，还帮我放进了收纳箱，感谢！', m6Created + 46 * MINUTE),
    },
  ];
}

function pastReviews(now: number): PastReview[] {
  return [
    {
      id: 'r1', fromUserId: 'u_lin', taskTitle: '帮取菜鸟驿站快递',
      rating: rating(5, ['准时送达', '沟通顺畅'], '比约定时间还早到了十分钟，很靠谱。', now - 3 * DAY),
    },
    {
      id: 'r2', fromUserId: 'u_yang', taskTitle: '一食堂带份牛肉面',
      rating: rating(5, ['态度友好', '物品完好'], '汤一点没洒，还提醒我拿筷子～', now - 6 * DAY),
    },
    {
      id: 'r3', fromUserId: 'u_zheng', taskTitle: '帮忙打印实验报告',
      rating: rating(4, ['沟通顺畅'], '稍微晚了几分钟，但提前告知了，理解。', now - 9 * DAY),
    },
  ];
}

function creditLogs(now: number): CreditLog[] {
  return [
    { id: 'c1', delta: 1, reason: '完成跑腿「帮取学院发的专业教材」', at: now - DAY - 5 * HOUR + 45 * MINUTE },
    { id: 'c2', delta: 1, reason: '收到五星好评', at: now - DAY - 5 * HOUR + 46 * MINUTE },
    { id: 'c3', delta: -2, reason: '跑腿超时送达（超出约定 8 分钟）', at: now - 9 * DAY },
    { id: 'c4', delta: 5, reason: '完成学生身份认证', at: now - 40 * DAY },
  ];
}

export function createSeedState(now = Date.now()): AppState {
  return {
    version: STATE_VERSION,
    savedAt: now,
    meId: ME_ID,
    users: Object.fromEntries(USERS.map((x) => [x.id, { ...x }])),
    tasks: [...myTasks(now), ...PLAZA.map((s) => buildTask(s, now))],
    creditLogs: creditLogs(now),
    pastReviews: pastReviews(now),
  };
}

/** 演示用「模拟接单」时可能出现的同学 */
export const SIMULATED_RUNNERS = ['u_liu', 'u_ma', 'u_he', 'u_wang', 'u_lin'];
