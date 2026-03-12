module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'genchinese2025';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: '未授权' });
  }

  const sb = async (path, method = 'GET', body = null, extra = {}) => {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        ...extra
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
    if (r.status === 204) return null;
    return r.json();
  };

  const { action } = req.query;

  try {
    // 词库 CRUD
    if (action === 'lexicon' && req.method === 'GET') {
      const data = await sb('lexicon?select=*&order=created_at.asc');
      return res.status(200).json(data || []);
    }
    if (action === 'lexicon' && req.method === 'POST') {
      const { char, pinyin, level, meaning, parts, story, audio_url } = req.body;
      if (!char) return res.status(400).json({ error: '汉字不能为空' });
      const result = await sb('lexicon', 'POST', {
        char, pinyin, level, meaning, parts, story, audio_url,
        updated_at: new Date().toISOString()
      }, { 'Prefer': 'return=representation' });
      return res.status(200).json(result);
    }
    if (action === 'lexicon' && req.method === 'PUT') {
      const { id, char, pinyin, level, meaning, parts, story, audio_url } = req.body;
      if (!id) return res.status(400).json({ error: '缺少 id' });
      const result = await sb(`lexicon?id=eq.${id}`, 'PATCH', {
        char, pinyin, level, meaning, parts, story, audio_url,
        updated_at: new Date().toISOString()
      }, { 'Prefer': 'return=representation' });
      return res.status(200).json(result);
    }
    if (action === 'lexicon' && req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: '缺少 id' });
      await sb(`lexicon?id=eq.${id}`, 'DELETE');
      return res.status(200).json({ ok: true });
    }

    // Dashboard
    if (action === 'stats') {
      const [logs, users, settings, lexicon] = await Promise.all([
        sb('api_logs?select=mode,success,created_at&order=created_at.desc&limit=1000'),
        sb('users?select=id,status,created_at'),
        sb('settings?select=key,value'),
        sb('lexicon?select=id')
      ]);
      const today = new Date().toISOString().split('T')[0];
      const todayLogs = (logs || []).filter(l => l.created_at?.startsWith(today));
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekLogs = (logs || []).filter(l => l.created_at > weekAgo);
      const modeCounts = { hanzi: 0, chengyu: 0, writing: 0 };
      (logs || []).forEach(l => { if (modeCounts[l.mode] !== undefined) modeCounts[l.mode]++; });
      const trend = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        trend[d] = 0;
      }
      weekLogs.forEach(l => { const d = l.created_at?.split('T')[0]; if (trend[d] !== undefined) trend[d]++; });
      const charCount = {};
      (logs || []).filter(l => l.mode === 'hanzi').forEach(l => { charCount[l.input] = (charCount[l.input] || 0) + 1; });
      const topChars = Object.entries(charCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return res.status(200).json({
        total: (logs || []).length, today: todayLogs.length, week: weekLogs.length,
        success_rate: (logs || []).length ? Math.round((logs || []).filter(l => l.success).length / (logs || []).length * 100) : 0,
        mode_counts: modeCounts, trend, top_chars: topChars,
        total_users: (users || []).length, paid_users: (users || []).filter(u => u.status === 'paid').length,
        lexicon_count: (lexicon || []).length,
        settings: Object.fromEntries(((settings) || []).map(s => [s.key, s.value]))
      });
    }

    // 用户
    if (action === 'users' && req.method === 'GET') {
      return res.status(200).json(await sb('users?select=*&order=created_at.desc') || []);
    }
    if (action === 'users' && req.method === 'POST') {
      const { id, ...data } = req.body;
      const result = id
        ? await sb(`users?id=eq.${id}`, 'PATCH', data, { 'Prefer': 'return=representation' })
        : await sb('users', 'POST', data, { 'Prefer': 'return=representation' });
      return res.status(200).json(result);
    }
    if (action === 'users' && req.method === 'DELETE') {
      await sb(`users?id=eq.${req.body.id}`, 'DELETE');
      return res.status(200).json({ ok: true });
    }

    // 设置
    if (action === 'settings' && req.method === 'GET') {
      return res.status(200).json(await sb('settings?select=*') || []);
    }
    if (action === 'settings' && req.method === 'POST') {
      const { key, value } = req.body;
      return res.status(200).json(await sb(`settings?key=eq.${key}`, 'PATCH',
        { value, updated_at: new Date().toISOString() }, { 'Prefer': 'return=representation' }));
    }

    // 日志
    if (action === 'logs') {
      return res.status(200).json(await sb('api_logs?select=*&order=created_at.desc&limit=100') || []);
    }

    return res.status(400).json({ error: '未知操作' });

  } catch (e) {
    console.error('Admin API error:', e);
    return res.status(500).json({ error: e.message });
  }
};
