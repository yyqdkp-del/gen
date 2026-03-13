// api/assess.js

const Anthropic = require('@anthropic-ai/sdk');

// 允许 Vercel 函数运行更长时间（最高 60 秒）
export const maxDuration = 60; 

const FALLBACK = {
  level: 'R3', level_desc: '句子理解期',
  insight: '孩子正处于中文学习的关键突破期，已经有了基础，只差一把钥匙。',
  blockpoint: '汉字对孩子来说还是符号，还没变成有意义的画面和故事。',
  action: '今晚用「休」字和孩子玩一个游戏：让他猜这个字在说什么故事。',
  local_line: '清迈的孩子每天看见榕树，「休」就是人靠着树——字就是画。',
  feature_rec: '从汉字拆解器开始，每天一个字，让汉字从符号变成故事。',
  cta: '领取你的专属学习路线图，开启第一个汉字故事 🌿'
};

const SYSTEM_PROMPT = `你是根·中文AI顾问，为清迈陪读家庭服务。根据问卷答案生成个性化报告。
严格且仅输出JSON，不要包含任何Markdown标记或其他文字。
JSON结构：
{"level":"R1-R5","level_desc":"级别名","insight":"现状一句话","blockpoint":"核心卡点","action":"本周一件事","local_line":"清迈本地金句","feature_rec":"功能推荐","cta":"行动召唤"}

R级别：R1认字<50，R2认字50-200，R3认字200-500能读但抗拒，R4认字500+愿读但词穷，R5流畅阅读书面弱`;

module.exports = async function(req, res) {
  // 1. CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // 2. 兼容解析 req.body
  let answers;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    answers = body?.answers;
  } catch (e) {
    console.error('Body parse error:', e.message);
  }

  if (!answers) {
    console.error('Error: No answers received from frontend.');
    return res.status(200).json(FALLBACK);
  }

  // 3. 调用 API
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514', 
      max_tokens: 1000,
      system: SYSTEM_PROMPT, 
      messages: [{ 
        role: 'user', 
        content: `答案：${JSON.stringify(answers)}` 
      }]
    });

    // 4. 清理并解析 JSON
    let text = msg.content[0].text;
    text = text.replace(/```json/ig, '').replace(/```/g, '').trim();
    
    try {
      const report = JSON.parse(text);
      return res.status(200).json(report);
    } catch(e) {
      console.error('JSON parse error. Raw output from Claude:', text);
      return res.status(200).json(FALLBACK);
    }

  } catch(e) {
    console.error('Anthropic API error:', e.message);
    return res.status(200).json(FALLBACK);
  }
};
