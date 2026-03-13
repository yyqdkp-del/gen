const Anthropic = require(’@anthropic-ai/sdk’);

const cache = global._cache || (global._cache = new Map());

const FALLBACK = {
level: ‘R3’,
level_desc: ‘句子理解期’,
insight: ‘孩子正处于中文学习的关键突破期，已经有了基础，只差一把钥匙。’,
blockpoint: ‘汉字对孩子来说还是符号，还没变成有意义的画面和故事。’,
action: ‘今晚用「休」字和孩子玩一个游戏：让他猜这个字在说什么故事。’,
local_line: ‘清迈的孩子每天看见榕树，「休」就是人靠着树——字就是画。’,
feature_rec: ‘从汉字拆解器开始，每天一个字，让汉字从符号变成故事。’,
cta: ‘领取你的专属学习路线图，开启第一个汉字故事 🌿’
};

const PROMPT = `你是根·中文AI学习顾问，专为清迈陪读家庭服务。
根据问卷答案生成个性化报告，严格输出JSON，不加其他文字：
{
“level”: “R1到R5之一”,
“level_desc”: “对应级别名称”,
“insight”: “一句话点出孩子状态（温暖有画面感）”,
“blockpoint”: “核心卡点（具体不说教）”,
“action”: “本周可做的一件事（超级具体）”,
“local_line”: “结合清迈生活的金句”,
“feature_rec”: “推荐根·中文哪个功能及原因”,
“cta”: “行动召唤文案”
}

R级别标准：
R1：认字<50，无法读绘本
R2：认字50-200，能读简单词语
R3：认字200-500，能读句子但累/抗拒
R4：认字500+，愿意读但写不出
R5：流畅阅读，书面表达弱

问卷答案：{answers}`;

function parseFields(body) {
const fields = body?.data?.fields || [];
const r = {};
fields.forEach((f, i) => {
r[`q${i+1}`] = Array.isArray(f.value) ? f.value.join(’, ’) : (f.value || ‘’);
});
return r;
}

module.exports = async function(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET, POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) return res.status(200).end();

if (req.method === ‘GET’) {
const id = req.query.id;
if (!id) return res.status(400).json({ error: ‘Missing id’ });
const report = cache.get(id);
if (!report) return res.status(404).json({ error: ‘Not found’, fallback: FALLBACK });
return res.status(200).json(report);
}

if (req.method === ‘POST’) {
const id = req.body?.data?.submissionId || String(Date.now());
const answers = parseFields(req.body);

```
try {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: PROMPT.replace('{answers}', JSON.stringify(answers)) }]
  });
  const text = msg.content[0].text.replace(/```json|```/g, '').trim();
  let report = FALLBACK;
  try { report = JSON.parse(text); } catch(e) {}
  cache.set(id, { ...report, id });
  setTimeout(() => cache.delete(id), 30 * 60 * 1000);
} catch(e) {
  console.error(e);
  cache.set(id, { ...FALLBACK, id });
}

return res.status(200).json({ ok: true, id });
```

}

return res.status(405).end();
};
