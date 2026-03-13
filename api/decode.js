const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { char } = req.body || {};
  if (!char) return res.status(400).json({ error: 'no char' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `你是汉字拆解专家。请拆解汉字「${char}」，严格只输出JSON，格式：
{"p1":"部件1","p2":"部件2","script":"妈妈台词（1-2句，温暖有画面感）","puzzle":"亲子谜题（1句，引发好奇）"}`
      }]
    });

    let text = msg.content[0].text;
    text = text.replace(/```json/ig,'').replace(/```/g,'').trim();
    return res.status(200).json(JSON.parse(text));

  } catch(e) {
    return res.status(200).json({
      p1: char, p2: '？',
      script: `「${char}」藏着古人的智慧，每一笔都有故事。`,
      puzzle: `你觉得「${char}」像什么？`
    });
  }
};
