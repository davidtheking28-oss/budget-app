import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useAdvisorProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(v => v + 1);

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let cancelled = false;
    setError(null);
    supabase
      .from('advisors')
      .select('display_name, logo_url, brand_color')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error: err }) => { if (cancelled) return; if (err) { setError(err); return; } setProfile(data || { display_name: null, logo_url: null, brand_color: null }); })
      .catch(err => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [userId, revision]);

  async function saveName(name) {
    try {
      const trimmed = name.trim() || null;
      const { error } = await supabase.from('advisors').update({ display_name: trimmed }).eq('user_id', userId);
      if (error) return false;
      setProfile(p => ({ ...p, display_name: trimmed }));
      return true;
    } catch {
      return false;
    }
  }

  async function saveLogo(file) {
    try {
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
    } catch {
      return false;
    }
  }

  async function removeLogo() {
    try {
      const { error } = await supabase.from('advisors').update({ logo_url: null }).eq('user_id', userId);
      if (error) return false;
      setProfile(p => ({ ...p, logo_url: null }));
      return true;
    } catch {
      return false;
    }
  }

  async function saveBrandColor(hex) {
    try {
      const { error } = await supabase.from('advisors').update({ brand_color: hex }).eq('user_id', userId);
      if (error) return false;
      setProfile(p => ({ ...p, brand_color: hex }));
      return true;
    } catch {
      return false;
    }
  }

  return { profile, error, reload, saveName, saveLogo, removeLogo, saveBrandColor };
}
