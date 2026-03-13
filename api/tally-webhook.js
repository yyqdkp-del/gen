// api/tally-webhook.js
// 接收Tally Webhook，调用Claude生成报告，存入内存缓存
// Vercel Serverless Function

const Anthropic = require(’@anthropic-ai/sdk’);

// ─────────────────────────────────────────────
// 简单内存缓存（Vercel无状态，用全局变量临时存）
// ─────────────────────────────────────────────
const reportCache = global.reportCache || (global.reportCache = new Map());

// ─────────────────────────────────────────────
// PROMPT_TEMPLATE
// ─────────────────────────────────────────────
const PROMPT_TEMPLATE = `
你是根·中文的学习顾问，专为清迈陪读家庭设计的AI评估系统。
你的人设是：一个既懂儿童语言发展、又在清迈生活过的妈妈朋友。
温暖、专业、不焦虑、给方向感。绝不说教。

根据以下问卷答案，生成个性化读写能力报告。

问卷答案：
{answers}

R级别判定标准：
R1·字符启蒙期：认字<50个，无法独立读绘本
R2·词汇积累期：认字50-200，能读简单词语
R3·句子理解期：认字200-500，能读句子但抗拒/觉得累
R4·流畅阅读期：认字500+，愿意读但写不出/词穷
R5·书面表达期：流畅阅读，书面表达弱

影子题（「休」字）：

- 像画 → 具备字理意识，R级别+0.5，重点推拆解器进阶
- 两个符号 → 缺乏字理意识，重点说明如何建立字理顿悟

严格按以下JSON格式输出，不要加任何其他文字：
{
“level”: “R3”,
“level_desc”: “句子理解期”,
“insight”: “一句话点出孩子真实状态（温暖，有画面感）”,
“blockpoint”: “卡点是什么（具体，不说教）”,
“action”: “本周可以做的一件事（超级具体）”,
“local_line”: “清迈本地化金句（结合清迈生活场景）”,
“feature_rec”: “推荐根·中文哪个功能，为什么”,
“cta”: “行动召唤文案（温暖有力）”
}
`;

const FALLBACK_REPORT = {
level: ‘R3’,
level_desc: ‘句子理解期’,
insight: ‘孩子正处于中文学习的关键突破期，已经有了基础，只差一把钥匙。’,
blockpoint: ‘汉字对孩子来说还是符号，还没变成有意义的画面和故事。’,
action: ‘今晚用「休」字和孩子玩一个游戏：让他猜这个字在说什么故事。’,
local_line: ‘清迈的孩子每天看见榕树，「休」就是人靠着树——字就是画。’,
feature_rec: ‘从汉字拆解器开始，每天一个字，让汉字从符号变成故事。’,
cta: ‘领取你的专属学习路线图，开启第一个汉字故事 🌿’
};

// ─────────────────────────────────────────────
// 解析Tally Webhook数据
// ─────────────────────────────────────────────
function parseTallyWebhook(body) {
try {
const fields = body?.data?.fields || [];
const answers = {};

```
fields.forEach((field, index) => {
  const key = `p${index + 1}`;
  const value = Array.isArray(field.value) 
    ? field.value.join(', ') 
    : (field.value || '');
  answers[key] = value;
});

// 映射到q1-q10格式
return {
  q1:  answers.p1  || '',  // 年级
  q2:  answers.p2  || '',  // 学校
  q3:  answers.p3  || '',  // 家庭语言
  q4:  answers.p4  || '',  // 绘本阅读
  q5:  answers.p5  || '',  // 无图理解
  q6:  answers.p6  || '',  // 认字数量
  q7:  answers.p7  || '',  // 拼音依赖
  q75: answers.p8  || '',  // 影子题
  q8:  answers.p9  || '',  // 写句子
  q9:  answers.p10 || '',  // 阅读意愿
  q10: answers.p11 || '',  // 中英对比
};
```

} catch (e) {
console.error(‘Parse error:’, e);
return {};
}
}

// ─────────────────────────────────────────────
// 主处理函数
// ─────────────────────────────────────────────
module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, GET, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();

// GET请求：读取缓存报告
if (req.method === ‘GET’) {
const { id } = req.query;
if (!id) return res.status(400).json({ error: ‘Missing id’ });

```
const cached = reportCache.get(id);
if (!cached) return res.status(404).json({ error: 'Report not found', fallback: FALLBACK_REPORT });

return res.status(200).json(cached);
```

}

// POST请求：接收Tally Webhook
if (req.method === ‘POST’) {
const answers = parseTallyWebhook(req.body);
const responseId = req.body?.data?.responseId || Date.now().toString();

```
console.log('Tally webhook received, responseId:', responseId);
console.log('Parsed answers:', answers);

// 异步生成报告
try {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: PROMPT_TEMPLATE.replace('{answers}', JSON.stringify(answers, null, 2))
    }]
  });

  const rawText = message.content[0].text;
  const cleanText = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let report;
  try {
    report = JSON.parse(cleanText);
  } catch {
    report = FALLBACK_REPORT;
  }

  // 存入缓存（30分钟）
  reportCache.set(responseId, { ...report, responseId });
  setTimeout(() => reportCache.delete(responseId), 30 * 60 * 1000);

  console.log('Report generated and cached for:', responseId);

} catch (error) {
  console.error('Claude API error:', error);
  reportCache.set(responseId, { ...FALLBACK_REPORT, responseId });
}

// 立即返回200给Tally（Tally要求快速响应）
return res.status(200).json({ received: true, responseId });
```

}

return res.status(405).json({ error: ‘Method not allowed’ });
}
