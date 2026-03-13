const Anthropic = require(’@anthropic-ai/sdk’);

const FALLBACK = {
level: ‘R3’, level_desc: ‘句子理解期’,
insight: ‘孩子正处于中文学习的关键突破期，已经有了基础，只差一把钥匙。’,
blockpoint: ‘汉字对孩子来说还是符号，还没变成有意义的画面和故事。’,
action: ‘今晚用「休」字和孩子玩一个游戏：让他猜这个字在说什么故事。’,
local_line: ‘清迈的孩子每天看见榕树，「休」就是人靠着树——字就是画。’,
feature_rec: ‘从汉字拆解器开始，每天一个字，让汉字从符号变成故事。’,
cta: ‘领取你的专属学习路线图，开启第一个汉字故事 🌿’
};

const PROMPT = `你是根·中文AI顾问，为清迈陪读家庭服务。根据问卷答案生成个性化报告。
只输出JSON，不加其他文字：
{“level”:“R1-R5”,“level_desc”:“级别名”,“insight”:“现状一句话”,“blockpoint”:“核心卡点”,“action”:“本周一件事”,“local_line”:“清迈本地金句”,“feature_rec”:“功能推荐”,“cta”:“行动召唤”}

R级别：R1认字<50，R2认字50-200，R3认字200-500能读但抗拒，R4认字500+愿读但词穷，R5流畅阅读书面弱

答案：{answers}`;

module.exports = async function(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).end();

const { answers } = req.body || {};
if (!answers) return res.status(200).json(FALLBACK);

try {
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const msg = await client.messages.create({
model: ‘claude-sonnet-4-20250514’,
max_tokens: 1000,
messages: [{ role: ‘user’, content: PROMPT.replace(’{answers}’, JSON.stringify(answers)) }]
});
const text = msg.content[0].text.replace(/`json|`/g, ‘’).trim();
try {
const report = JSON.parse(text);
return res.status(200).json(report);
} catch(e) {
return res.status(200).json(FALLBACK);
}
} catch(e) {
console.error(‘API error:’, e.message);
return res.status(200).json(FALLBACK);
}
};
