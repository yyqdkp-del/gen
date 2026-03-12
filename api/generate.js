export default async function handler(req, res) {
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
prompt = `输入汉字：${char} 返回JSON，格式如下，不要任何额外文字： {"pinyin":"míng","meaning":"明亮光明","level":"R2","parts":[{"char":"日","name":"太阳","image":"温暖光芒"},{"char":"月","name":"月亮","image":"夜空银光"}],"story":"太阳和月亮一起出现，天地最亮。古人看见天空，造出了这个字。","scene":"清迈夜市的灯笼像月亮，照亮了整条街。","mom_questions":["你能找到这个字的两个部分吗？","为什么太阳月亮在一起会明亮？","清迈哪里最明亮？"],"extension":["明天：今天之后的一天","明白：理解清楚"],"chengyu":"明察秋毫","cy_story":"形容眼睛很厉害，连秋天细细的毛发都看得清楚。"} 现在为「${char}」生成同样格式的JSON：`;

} else if (mode === ‘chengyu’) {
if (!sentence || sentence.trim().length < 2) return res.status(400).json({ error: ‘请输入一个情境或词语’ });
prompt = `孩子说了这句话或描述了这个情境：「${sentence}」 这是清迈陪读家庭的孩子，经常说"英式中文"。 请分析并返回JSON，格式如下： {"original":"very many people at the market","issue":"英式中文，直接翻译英文结构","chengyu":"人山人海","pinyin":"rén shān rén hǎi","meaning":"形容人非常多，像山像海一样密集","story":"古时候庙会，人多得像山丘和大海，挤都挤不动。","chiangmai_scene":"周日清迈 Walking Street 夜市，人山人海，大象表演前面站满了人。","how_to_use":"妈妈可以说：你看这个夜市，我们用中文怎么说？对了，人山人海！","similar":["摩肩接踵","车水马龙"],"mom_script":"哇今天夜市好多人！用英文你会说 very many people，但用中文，我们有个超厉害的词——人山人海！山和海放在一起，你能想象多少人吗？"} 现在为「${sentence}」生成同样格式的JSON：`;

} else if (mode === ‘writing’) {
if (!sentence || sentence.trim().length < 5) return res.status(400).json({ error: ‘请输入孩子的口述内容’ });
const keywordStr = keywords ? `，本周学的字/词：${keywords}` : ‘’;
prompt = `孩子口述了这段话：「${sentence}」${keywordStr} 这是清迈陪读家庭的孩子，口语流利但书面中文较弱。 请帮助转化成书面作文，返回JSON格式如下： {"original":"${sentence}","issues":["口语化表达","缺少书面词汇"],"draft":"这是转化后的书面中文作文，2-4句，自然流畅，融入本周学的字","keywords_used":["已融入的关键字列表"],"mom_script":"妈妈念给孩子听的完整脚本，温柔引导，包括：1.先夸孩子说得好 2.展示书面版本 3.引导孩子找出不同","fill_blanks":"把作文中的关键字替换成___，让孩子填空的版本","tips":"给妈妈的小贴士，如何引导孩子理解口语和书面的区别"} 现在为这段口述生成JSON：`;

} else {
return res.status(400).json({ error: ‘未知模式，请指定 mode: hanzi/chengyu/writing’ });
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
}
