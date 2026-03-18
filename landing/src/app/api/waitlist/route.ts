import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, role, companySize, expectations } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('waitlist').insert({
        email,
        role: role || null,
        company_size: companySize || null,
        notes: expectations || null,
        source: 'landing',
      });

      if (error && error.code !== '23505') {
        // 23505 = duplicate email — treat as success
        console.error('[waitlist] Supabase insert error:', error);
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
      }
    } else {
      // Supabase not configured — log and continue so form still "works"
      console.warn('[waitlist] Supabase env vars not set. Entry not persisted:', { email, role, companySize });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist] Unexpected error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
