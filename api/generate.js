module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持POST' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API Key未配置' });

  const { mode, char, sentence, keywords } = req.body;
  let system = '只输出JSON对象，不加任何其他文字，不用代码块包裹，直接{开头}结尾。';
  let prompt = '';

  if (mode === 'hanzi') {
    prompt = `为汉字「${char}」生成JSON：{"pinyin":"","meaning":"","level":"R2","parts":[{"char":"","name":"","image":""}],"story":"","scene":"清迈场景","mom_questions":["问题1","问题2"],"extension":["词1","词2"],"chengyu":"","cy_story":""}`;
  } else if (mode === 'chengyu') {
    prompt = `孩子说：「${sentence}」，生成成语教学JSON：{"original":"","issue":"","chengyu":"","pinyin":"","meaning":"","story":"","chiangmai_scene":"","mom_script":"","similar":["",""]}`; 
  } else if (mode === 'writing') {
    const kw = keywords ? `本周学的字：${keywords}` : '';
    prompt = `孩子口述：「${sentence}」${kw}，生成书面化JSON：{"original":"","draft":"","keywords_used":[""],"fill_blanks":"","mom_script":"","tips":""}`;
  } else {
    return res.status(400).json({ error: '未知模式' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = (data?.content?.[0]?.text || '').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: '格式错误' });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
