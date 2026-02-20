import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST (from Vercel Cron) or GET (for manual triggers)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Missing Supabase configuration' });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/visual-api/cron/tick`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('[CRON] Failed to trigger tick:', error);
    return res.status(500).json({ error: error.message || 'Cron tick failed' });
  }
}
