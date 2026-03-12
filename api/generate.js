const fetch = (…args) => import(‘node-fetch’).then(({default: f}) => f(…args));

module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘仅支持POST’ });

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) return res.status(500).json({ error: ‘API Key未配置’ });

const { mode, char, sentence, keywords } = req.body;

let system = ‘只输出JSON对象，不加任何其他文字，不用代码块包裹，直接{开头}结尾。’;
let prompt = ‘’;

if (mode === ‘hanzi’) {
if (!char || char.length !== 1) return res.status(400).json({ error: ‘请输入单个汉字’ });
prompt = `输入汉字：${char} 返回JSON，格式如下，不要任何额外文字： {"pinyin":"míng","meaning":"明亮光明","level":"R2","parts":[{"char":"日","name":"太阳","image":"温暖光芒"},{"char":"月","name":"月亮","image":"夜空银光"}],"story":"太阳和月亮一起出现，天地最亮。","scene":"清迈夜市的灯笼像月亮，照亮了整条街。","mom_questions":["你能找到这个字的两个部分吗？","为什么太阳月亮在一起会明亮？"],"extension":["明天：今天之后的一天","明白：理解清楚"],"chengyu":"明察秋毫","cy_story":"形容眼睛很厉害，连秋天细细的毛发都看得清楚。"} 现在为「${char}」生成同样格式的JSON：`;

} else if (mode === ‘chengyu’) {
if (!sentence || sentence.trim().length < 2) return res.status(400).json({ error: ‘请输入一个情境或词语’ });
prompt = `孩子说了这句话：「${sentence}」这是清迈陪读家庭的孩子，经常说英式中文。 返回JSON：{"original":"${sentence}","issue":"问题描述","chengyu":"成语","pinyin":"拼音","meaning":"含义","story":"来源故事","chiangmai_scene":"清迈场景","mom_script":"妈妈台词","similar":["近义词1","近义词2"]}`;

} else if (mode === ‘writing’) {
if (!sentence || sentence.trim().length < 5) return res.status(400).json({ error: ‘请输入孩子的口述内容’ });
const keywordStr = keywords ? `，本周学的字：${keywords}` : ‘’;
prompt = `孩子口述：「${sentence}」${keywordStr}。这是清迈陪读家庭的孩子，口语流利但书面中文较弱。 返回JSON：{"original":"${sentence}","draft":"书面作文版本2-4句","keywords_used":["已融入关键字"],"fill_blanks":"填空版本用___替换关键字","mom_script":"妈妈台词脚本","tips":"给妈妈的小贴士"}`;

} else {
return res.status(400).json({ error: ‘未知模式’ });
}

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
max_tokens: 1500,
system,
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
};
