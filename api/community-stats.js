// GET /api/community-stats — returns Telegram community member counts
export default async function handler(req, res) {
  const token = process.env.BROADCAST_BOT_TOKEN;
  if (!token) return res.status(200).json({ members: null, error: 'No token' });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getChatMembersCount?chat_id=${process.env.COMMUNITY_CHAT_ID || '-1003930752060'}`);
    const d = await r.json();
    const members = d.result || null;
    return res.status(200).json({ ok: true, members });
  } catch (e) {
    return res.status(200).json({ members: null, error: e.message });
  }
}
