/**
 * 🎨 根·中文 AI 评估接口 (api/assess.js)
 * ----------------------------------------------------
 * 负责接收前端问卷数据，调用 Claude API 生成个性化评估报告。
 */

const Anthropic = require('@anthropic-ai/sdk');

// [配置] 允许 Vercel 函数最长运行 60 秒，防止 AI 思考超时被强杀
export const maxDuration = 60;

// [兜底数据] 当 API 异常或超时时返回的默认报告，确保用户体验不中断
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

// [AI 人设与规则] 决定了生成的文案语感和质感
const SYSTEM_PROMPT = `
你是根·中文AI顾问，为清迈陪读家庭服务。
请根据问卷答案生成个性化报告。

【输出规范】
1. 严格且仅输出纯 JSON 格式，不要包含 \`\`\`json 标记或其他多余文字。
2. 语气：温暖、专业、像妈妈朋友一样，绝不说教。
3. 文本美学：可以在洞察或行动建议中，克制地使用 1-2 个 Emoji 点缀。长句子请合理使用标点。

【JSON 数据结构】
{
  "level": "R1/R2/R3/R4/R5",
  "level_desc": "级别名称（如：句子理解期）",
  "insight": "现状洞察（1-2句话，温暖有共鸣）",
  "blockpoint": "核心卡点（精准指出孩子遇到的具体困难）",
  "action": "本周核心行动（具体、极简、可立刻执行）",
  "local_line": "清迈本地金句（必须结合清迈生活方式或国际学校多语环境）",
  "feature_rec": "产品功能推荐（说明为什么适合这个阶段）",
  "cta": "行动召唤（带点仪式感，不焦虑）"
}

【R级别判定参考】
- R1：认字 < 50
- R2：认字 50-200
- R3：认字 200-500，能读但抗拒
- R4：认字 500+，愿读但词穷
- R5：流畅阅读，但书面表达弱
`.trim();

  // 1. CORS 设置 (允许跨域请求)


  // 2. 解析前端传来的问卷答案
  let answers;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    answers = body?.answers;
  } catch (error) {
    console.error('⚠️ 前端数据解析失败:', error.message);
  }

  // 若无数据，优雅降级
  if (!answers) {
    console.warn('⚠️ 未接收到 answers 数据，返回兜底报告。');
    return res.status(200).json(FALLBACK_REPORT);
  }

  // 3. 调用大模型 API
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
     model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ 
        role: 'user', 
        content: `用户问卷答案：${JSON.stringify(answers)}` 
      }]
    });

    // 4. 清理并解析 AI 返回的 JSON
    let aiResponseText = msg.content[0].text;
    aiResponseText = aiResponseText.replace(/```json/ig, '').replace(/```/g, '').trim();
    
    try {
      const generatedReport = JSON.parse(aiResponseText);
      return res.status(200).json(generatedReport);
    } catch (parseError) {
      console.error('❌ AI 返回的数据不是合法的 JSON:', aiResponseText);
      return res.status(200).json(FALLBACK_REPORT);
    }

  } catch (apiError) {
    console.error('❌ Anthropic API 调用报错:', apiError.message);
    return res.status(200).json(FALLBACK_REPORT);
  }
};
