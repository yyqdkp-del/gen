export default async function handler(req, res) {
// CORS
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘仅支持POST’ });

const { char } = req.body;
if (!char || char.length !== 1) return res.status(400).json({ error: ‘请输入单个汉字’ });

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) return res.status(500).json({ error: ‘API Key未配置’ });

const prompt = `输入汉字：${char} 返回JSON，格式如下，不要任何额外文字： {"pinyin":"míng","meaning":"明亮光明","level":"R2","parts":[{"char":"日","name":"太阳","image":"温暖光芒"},{"char":"月","name":"月亮","image":"夜空银光"}],"story":"太阳和月亮一起出现，天地最亮。古人看见天空，造出了这个字。","scene":"清迈夜市的灯笼像月亮，照亮了整条街。","mom_questions":["你能找到这个字的两个部分吗？","为什么太阳月亮在一起会明亮？","清迈哪里最明亮？"],"extension":["明天：今天之后的一天","明白：理解清楚"],"chengyu":"明察秋毫","cy_story":"形容眼睛很厉害，连秋天细细的毛发都看得清楚。"} 现在为「${char}」生成同样格式的JSON：`;

try {
const response = await fetch(‘https://api.anthropic.com/v1/messages’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘x-api-key’: apiKey,
‘anthropic-version’: ‘2023-06-01’
},
body: JSON.stringify({
model: ‘claude-haiku-4-5-20251001’,
max_tokens: 1200,
system: ‘只输出JSON对象，不加任何其他文字，不用代码块包裹，直接{开头}结尾。’,
messages: [{ role: ‘user’, content: prompt }]
})
});

```
const data = await response.json();
if (data.error) return res.status(500).json({ error: data.error.message });

const raw = (data?.content?.[0]?.text || '').trim();
const m = raw.match(/\{[\s\S]*\}/);
if (!m) return res.status(500).json({ error: '生成格式错误，请重试' });

const result = JSON.parse(m[0]);
return res.status(200).json(result);
```

} catch (e) {
return res.status(500).json({ error: e.message || ‘服务器错误’ });
}
}
