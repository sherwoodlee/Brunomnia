import type { CookieRecord } from '../types';
import { Icon } from './Icon';

const cookieId = () => `cookie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function CookieEditor({ cookies, requestUrl, onChange }: { cookies: CookieRecord[]; requestUrl: string; onChange: (cookies: CookieRecord[]) => void }) {
  const update = (id: string, patch: Partial<CookieRecord>) => onChange(cookies.map((cookie) => cookie.id === id ? { ...cookie, ...patch } : cookie));
  const add = () => {
    let domain = 'localhost';
    try { domain = new URL(requestUrl).hostname || domain; } catch { /* keep local default */ }
    onChange([...cookies, { id: cookieId(), name: 'cookie', value: '', domain, path: '/', secure: requestUrl.startsWith('https:'), httpOnly: false, sameSite: '', hostOnly: true, createdAt: new Date().toISOString() }]);
  };
  if (!cookies.length) return <div className="empty-state"><Icon name="archive" size={28} /><strong>No workspace cookies</strong><span>Cookies returned by native requests appear here automatically.</span><button className="secondary-button compact-button" onClick={add} type="button">Add cookie</button></div>;
  return (
    <div className="cookie-manager">
      <header><div><strong>Workspace cookie jar</strong><span>{cookies.length} stored</span></div><button onClick={add} type="button"><Icon name="plus" size={14} /> Add cookie</button></header>
      <div className="cookie-list">{cookies.map((cookie) => <article key={cookie.id}>
        <label>Name<input value={cookie.name} onChange={(event) => update(cookie.id, { name: event.target.value })} /></label>
        <label>Value<input value={cookie.value} onChange={(event) => update(cookie.id, { value: event.target.value })} /></label>
        <label>Domain<input value={cookie.domain} onChange={(event) => update(cookie.id, { domain: event.target.value.toLowerCase() })} /></label>
        <label>Path<input value={cookie.path} onChange={(event) => update(cookie.id, { path: event.target.value || '/' })} /></label>
        <label className="cookie-flag"><input checked={cookie.secure} onChange={(event) => update(cookie.id, { secure: event.target.checked })} type="checkbox" /> Secure</label>
        <label className="cookie-flag"><input checked={cookie.httpOnly} onChange={(event) => update(cookie.id, { httpOnly: event.target.checked })} type="checkbox" /> HTTP only</label>
        <label>SameSite<select value={cookie.sameSite} onChange={(event) => update(cookie.id, { sameSite: event.target.value as CookieRecord['sameSite'] })}><option value="">Unspecified</option><option value="lax">Lax</option><option value="strict">Strict</option><option value="none">None</option></select></label>
        <label>Expires<input type="datetime-local" value={cookie.expires ? cookie.expires.slice(0, 16) : ''} onChange={(event) => update(cookie.id, { expires: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label>
        <label className="cookie-flag"><input checked={cookie.hostOnly} onChange={(event) => update(cookie.id, { hostOnly: event.target.checked })} type="checkbox" /> Host only</label>
        <button aria-label={`Delete ${cookie.name}`} className="icon-button subtle" onClick={() => onChange(cookies.filter((candidate) => candidate.id !== cookie.id))} type="button"><Icon name="trash" size={14} /></button>
      </article>)}</div>
    </div>
  );
}
