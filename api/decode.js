const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { char, mode } = req.body || {};
  if (!char) return res.status(400).json({ error: 'no input' });

  const prompts = {
    char: `拆解汉字「${char}」，严格只输出JSON：
{"p1":"部件1","p2":"部件2","script":"妈妈台词（温暖有画面感，1-2句）","puzzle":"亲子谜题（1句，引发好奇）"}`,

    idiom: `解读成语「${char}」，严格只输出JSON：
{"p1":"成语","p2":"朝代/出处","script":"画面感解释（像讲故事一样，2-3句，让孩子能想象出来）","puzzle":"亲子谜题（1句，联系生活场景）"}`,

    culture: `解读这句中文「${char}」的文化背景，严格只输出JSON：
{"p1":"关键词","p2":"文化符号","script":"文化背景故事（2-3句，温暖有趣，适合清迈华人家庭）","puzzle":"亲子讨论题（1句，连接孩子的生活）"}`
  };

  const prompt = prompts[mode] || prompts.char;

  const fallbacks = {
    char: { p1: char, p2: '？', script: `「${char}」藏着古人的智慧，每一笔都有故事。`, puzzle: `你觉得「${char}」像什么？` },
    idiom: { p1: char, p2: '经典成语', script: `「${char}」是一幅充满智慧的画面，古人用四个字说尽了一个道理。`, puzzle: `这个成语让你想到了什么场景？` },
    culture: { p1: char, p2: '中华文化', script: `这句话承载着中国人代代相传的生活智慧。`, puzzle: `在清迈的生活里，你有没有类似的感受？` }
  };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = msg.content[0].text;
    text = text.replace(/```json/ig,'').replace(/```/g,'').trim();
    return res.status(200).json(JSON.parse(text));

  } catch(e) {
    return res.status(200).json(fallbacks[mode] || fallbacks.char);
  }
};
