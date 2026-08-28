import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useAdvisorProfile(userId) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let cancelled = false;
    supabase
      .from('advisors')
      .select('display_name, logo_url')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setProfile(data || { display_name: null, logo_url: null }); });
    return () => { cancelled = true; };
  }, [userId]);

  async function saveName(name) {
    const trimmed = name.trim() || null;
    const { error } = await supabase.from('advisors').update({ display_name: trimmed }).eq('user_id', userId);
    if (error) return false;
    setProfile(p => ({ ...p, display_name: trimmed }));
    return true;
  }

  async function saveLogo(file) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${userId}/logo.${ext}`;
    const { error: upErr } = await supabase.storage.from('advisor-logos').upload(path, file, { upsert: true });
    if (upErr) return false;
    const { data: pub } = supabase.storage.from('advisor-logos').getPublicUrl(path);
    // cache-bust so a re-uploaded logo at the same path shows immediately, not the stale CDN copy
    const url = pub.publicUrl + '?t=' + Date.now();
    const { error } = await supabase.from('advisors').update({ logo_url: url }).eq('user_id', userId);
    if (error) return false;
    setProfile(p => ({ ...p, logo_url: url }));
    return true;
  }

  async function removeLogo() {
    const { error } = await supabase.from('advisors').update({ logo_url: null }).eq('user_id', userId);
    if (error) return false;
    setProfile(p => ({ ...p, logo_url: null }));
    return true;
  }

  return { profile, saveName, saveLogo, removeLogo };
}
