import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseProjectUrl } from '@/lib/apiBase';

const supabaseUrl = getSupabaseProjectUrl();
const supabaseAnonKey = getSupabaseAnonKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const VISUAL_BUCKET = 'visual';
