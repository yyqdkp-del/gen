const Anthropic = require('@anthropic-ai/sdk');

export const maxDuration = 60;

const FALLBACK_REPORT = {
  level: "R3",
  level_desc: "句子理解期",
  insight: "孩子正处于中文学习的关键突破期，已经有了基础，只差一把钥匙。",
  blockpoint: "汉字对孩子来说还是符号，还没变成有意义的画面和故事。",
  action: "今晚用「休」字和孩子玩一个游戏：让他猜这个字在说什么故事。",
  local_line: "清迈的孩子每天看见榕树，「休」就是人靠着树——字就是画。",
  feature_rec: "从汉字拆解器开始，每天一个字，让汉字从符号变成故事。",
  cta: "领取你的专属学习路线图，开启第一个汉字故事 🌿"
};

const SYSTEM_PROMPT = `
你是根·中文AI顾问，为清迈陪读家庭服务。
请根据问卷答案生成个性化报告。

【输出规范】
1. 严格且仅输出纯 JSON 格式，不要包含 \`\`\`json 标记或其他多余文字。
2. 语气：温暖、专业、像妈妈朋友一样，绝不说教。
3. 文本美学：可以在洞察或行动建议中，克制地使用 1-2 个 Emoji 点缀。

【JSON 数据结构】
{
  "level": "R1/R2/R3/R4/R5",
  "level_desc": "级别名称",
  "insight": "现状洞察",
  "blockpoint": "核心卡点",
  "action": "本周核心行动",
  "local_line": "清迈本地金句",
  "feature_rec": "产品功能推荐",
  "cta": "行动召唤"
}

【R级别判定参考】
- R1：认字 < 50
- R2：认字 50-200
- R3：认字 200-500，能读但抗拒
- R4：认字 500+，愿读但词穷
- R5：流畅阅读，但书面表达弱
`.trim();

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let answers;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    answers = body?.answers;
  } catch (error) {
    console.error('解析失败:', error.message);
  }

  if (!answers) {
    return res.status(200).json(FALLBACK_REPORT);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `用户问卷答案：${JSON.stringify(answers)}` }]
    });

    let text = msg.content[0].text;
    text = text.replace(/```json/ig, '').replace(/```/g, '').trim();
    
    try {
      return res.status(200).json(JSON.parse(text));
    } catch {
      return res.status(200).json(FALLBACK_REPORT);
    }

  } catch (apiError) {
    console.error('API报错:', apiError.message);
    return res.status(200).json(FALLBACK_REPORT);
  }
};
