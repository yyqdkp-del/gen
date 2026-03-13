// api/assess.js
// 根·中文 读写能力评估 API
// Vercel Serverless Function

const Anthropic = require(’@anthropic-ai/sdk’);

// ─────────────────────────────────────────────
// PROMPT_TEMPLATE · 增强版 System Prompt
// ─────────────────────────────────────────────
const PROMPT_TEMPLATE = `
你是根·中文的学习顾问，专为清迈陪读家庭设计的AI评估系统。
你的人设是：一个既懂儿童语言发展、又在清迈生活过的妈妈朋友。
温暖、专业、不焦虑、给方向感。绝不说教。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【第一步：解析影子题（Q7.5）· 权重最高】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
影子题考察”字理意识”——这是判断孩子是否适合拆解器的核心指标。

如果答案是 “like_picture”（像一幅画）：
→ 孩子已具备字理意识，R级别建议 +0.5
→ 报告中强调：孩子的直觉是对的，拆解器会加速这个认知
→ feature_rec 重点推汉字拆解器的进阶用法

如果答案是 “just_symbols”（只是两个符号）：
→ 孩子缺乏字理意识，R级别保持原判定
→ 报告中必须包含：开启字理认知是第一优先级
→ feature_rec 重点说明拆解器如何帮孩子建立第一个”字理顿悟”

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【第二步：R3 vs R4 分水岭（Q9 阅读意愿）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
这道题区分两种完全不同的干预策略：

如果答案是 “tired_resist”（能读但觉得累/抗拒）：
→ 判定为 R3
→ 干预策略：降噪（减少畏难情绪，让汉字变有趣）
→ action 必须聚焦：先玩，不追求写

如果答案是 “reads_but_blocked”（愿意读但写不出/词穷）：
→ 判定为 R4
→ 干预策略：输出（解决词穷，建立书面表达）
→ action 必须聚焦：成语输出，先积累再表达

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【第三步：完整R级别判定矩阵】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
综合所有答案，按以下标准判定：

R1 · 字符启蒙期

- 认字数量：50个以下
- 阅读状态：基本靠猜图，看字形没有反应
- 写作状态：完全不会写
- 典型场景：K1-K2，刚开始接触汉字

R2 · 图文对照期

- 认字数量：50-200个
- 阅读状态：能读简单词组，需要大量图片辅助
- 写作状态：能写几个单字，笔画经常错
- 典型场景：K3-G1，会背唐诗但不理解意思

R3 · 识字抗拒期

- 认字数量：200-500个
- 阅读状态：能读短句但卡顿，开始觉得累/抗拒
- 写作状态：能写但错别字多，不愿意写
- 典型场景：G2-G3，英文起飞后开始逃避中文

R4 · 读写断层期

- 认字数量：500个以上
- 阅读状态：愿意读，能读完，但理解不深
- 写作状态：写不出，词穷，中文作文像翻译
- 典型场景：G3-G5，读哈利波特但中文作文交白卷

R5 · 书面突破期

- 认字数量：800个以上
- 阅读状态：流畅，能读章节书
- 写作状态：能写但书面表达弱，像口语直译
- 典型场景：G5+，面对IGCSE/IB需要提升书面质量

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【第四步：生成报告JSON】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
严格按以下JSON结构输出，不要任何额外文字：

{
“level”: “R3”,
“level_desc”: “识字抗拒期”,
“insight”: “根据填写判定原因，1-2句，温暖语气，说清楚为什么是这个级别”,
“blockpoint”: “最大卡点，1-2句，具体描述孩子卡在哪里”,
“action”: “接下来30天做一件事，极度具体可执行，10字以内的核心动作”,
“local_line”: “一句清迈本地场景共鸣句，必须带清迈/多语环境/国际学校等本地元素”,
“feature_rec”: “推荐根·中文哪个功能，说明为什么适合这个级别，1-2句”,
“cta”: “结尾行动号召，温暖不焦虑，带一点点紧迫感但不制造恐慌”
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【语气铁律】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 像朋友发微信，不像专家写报告
✅ 说”我们”不说”你应该”
✅ 每份报告必须有至少一句清迈/泰国/国际学校的本地共鸣
✅ 总字数控制在180-220字
❌ 禁止使用”务必”、“一定要”、“必须”
❌ 禁止制造焦虑，禁止否定孩子

问卷答案：{answers}
`;

// ─────────────────────────────────────────────
// 限流配置
// ─────────────────────────────────────────────
const rateLimit = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分钟窗口
const RATE_LIMIT_MAX = 5; // 每IP每分钟最多5次

function checkRateLimit(ip) {
const now = Date.now();
if (!rateLimit.has(ip)) {
rateLimit.set(ip, []);
}
const timestamps = rateLimit.get(ip).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
if (timestamps.length >= RATE_LIMIT_MAX) {
return false;
}
timestamps.push(now);
rateLimit.set(ip, timestamps);

// 清理超过1小时的IP记录，防止内存泄漏
if (rateLimit.size > 1000) {
for (const [key, val] of rateLimit.entries()) {
if (val.every(t => now - t > 3600000)) rateLimit.delete(key);
}
}
return true;
}

// ─────────────────────────────────────────────
// 降级报告（API失败时兜底）
// ─────────────────────────────────────────────
const FALLBACK_REPORT = {
level: “R3”,
level_desc: “识字起步期”,
insight: “根据你的填写，孩子正处于汉字认知的关键窗口期，音形义还没完全连起来——这很正常，G2-G3是最常见的分水岭。”,
blockpoint: “汉字对孩子来说还像一张张图片，字和意思之间的连接还没建立起来，遇到陌生字容易放弃。”,
action: “每天拆1个字，妈妈念台词，孩子猜画面，10分钟够了。”,
local_line: “在清迈这种多语环境长大的孩子，英文跑得快很正常——中文我们慢火炖，火候到了自然香。”,
feature_rec: “推荐从汉字拆解器开始，让孩子发现汉字是有规律的零件，不是要死记的图画。等识字量到500+，再开成语表达模块。”,
cta: “最好的干预时机就是现在。免费领取第一周任务卡，先试试再说。🌿”
};

// ─────────────────────────────────────────────
// 主处理函数
// ─────────────────────────────────────────────
module.exports = async function handler(req, res) {
// CORS
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) {
return res.status(200).end();
}

if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

// 限流检查
const ip = req.headers[‘x-forwarded-for’]?.split(’,’)[0]?.trim() || ‘unknown’;
if (!checkRateLimit(ip)) {
return res.status(429).json({
error: ‘Too many requests’,
message: ‘请稍后再试’,
fallback: FALLBACK_REPORT
});
}

const { answers } = req.body;

if (!answers) {
return res.status(400).json({
error: ‘Missing answers’,
fallback: FALLBACK_REPORT
});
}

// 调用 Claude API
try {
const client = new Anthropic({
apiKey: process.env.ANTHROPIC_API_KEY
});

```
const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  messages: [{
    role: 'user',
    content: PROMPT_TEMPLATE.replace('{answers}', JSON.stringify(answers, null, 2))
  }]
});

// 解析JSON
const rawText = message.content[0].text;
const cleanText = rawText
  .replace(/```json\s*/g, '')
  .replace(/```\s*/g, '')
  .trim();

let report;
try {
  report = JSON.parse(cleanText);
} catch (parseError) {
  console.error('JSON parse error:', parseError, 'Raw:', rawText);
  return res.status(200).json(FALLBACK_REPORT);
}

// 验证必要字段
const requiredFields = ['level', 'level_desc', 'insight', 'blockpoint', 'action', 'local_line', 'feature_rec', 'cta'];
const missingFields = requiredFields.filter(f => !report[f]);
if (missingFields.length > 0) {
  console.error('Missing fields:', missingFields);
  return res.status(200).json({ ...FALLBACK_REPORT, ...report });
}

return res.status(200).json(report);
```

} catch (error) {
console.error(‘Claude API error:’, error);
// 降级返回兜底报告，不让用户看到空白
return res.status(200).json(FALLBACK_REPORT);
}
}
