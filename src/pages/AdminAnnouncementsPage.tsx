import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil } from 'lucide-react';
import { supabase } from '../contexts/AuthContext';
import type { Announcement, AnnouncementForm } from '../types/announcement';
import { Button } from '../components/ui/button';
import '../styles/admin.css';

const emptyForm: AnnouncementForm = {
  title: '', content: '', banner_text: '', is_published: false,
  show_in_banner: false, display_order: 0,
};
const columns = 'id,slug,title,content,banner_text,is_published,show_in_banner,display_order,created_at,updated_at';
const toForm = (item: Announcement): AnnouncementForm => ({
  title: item.title, content: item.content, banner_text: item.banner_text,
  is_published: item.is_published && item.show_in_banner,
  show_in_banner: item.is_published && item.show_in_banner, display_order: item.display_order,
});

export function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const dirty = editing && JSON.stringify(form) !== JSON.stringify(selected ? toForm(selected) : emptyForm);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: queryError } = await supabase.from('home_announcements')
          .select(columns).order('display_order').order('created_at', { ascending: false });
        if (queryError) throw queryError;
        if (active) setItems(data ?? []);
      } catch (cause) {
        console.error('공지 목록 조회 실패', cause);
        if (active) setError('공지를 불러오지 못했습니다. 다시 시도해주세요.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const start = (item: Announcement | null) => {
    setSelected(item); setForm(item ? toForm(item) : emptyForm);
    setEditing(true); setError(''); setMessage('');
    window.scrollTo(0, 0);
  };
  const cancel = () => {
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버리고 목록으로 돌아갈까요?')) return;
    setEditing(false); setError('');
  };
  const update = <K extends keyof AnnouncementForm>(key: K, value: AnnouncementForm[K]) =>
    setForm(previous => ({ ...previous, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() || !form.banner_text.trim()) {
      setError('제목과 배너 문구를 입력해주세요.'); return;
    }
    if (!Number.isInteger(form.display_order) || form.display_order < 0 || form.display_order > 2147483647) {
      setError('표시 순서는 0 이상의 정수로 입력해주세요.'); return;
    }
    setSaving(true); setError(''); setMessage('');
    try {
      const payload = { ...form, title: form.title.trim(), content: form.content.trim(),
        banner_text: form.banner_text.trim(), updated_at: new Date().toISOString() };
      // Returning one row also detects an UPDATE rejected by RLS (zero rows).
      const result = selected
        ? await supabase.from('home_announcements').update(payload).eq('id', selected.id).select(columns).single()
        : await supabase.from('home_announcements').insert({ ...payload, slug: 'notice-' + crypto.randomUUID() }).select(columns).single();
      if (result.error) throw result.error;
      const saved = result.data as Announcement;
      setItems(previous => [...previous.filter(item => item.id !== saved.id), saved]
        .sort((a, b) => a.display_order - b.display_order || b.created_at.localeCompare(a.created_at)));
      setSelected(saved); setForm(toForm(saved));
      setMessage('저장했습니다. 홈 배너 변경은 홈 화면을 다시 열면 반영됩니다.');
    } catch (cause) {
      console.error('공지 저장 실패', cause);
      setError('저장하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도해주세요. 입력 내용은 유지됩니다.');
    } finally { setSaving(false); }
  }

  return (
    <main className="admin-shell">
      <div className="admin-container">
        {editing
          ? <button className="admin-back" onClick={cancel} disabled={saving}><ArrowLeft size={16} /> 공지 목록</button>
          : <Link className="admin-back" to="/admin"><ArrowLeft size={16} /> 관리자 홈</Link>}
        <header className="admin-heading">
          <div><p className="admin-eyebrow">ALL LEET · 공지 관리</p>
            <h1>{editing ? (selected ? '공지 수정' : '새 공지 작성') : '공지 관리'}</h1>
            <p>{editing ? '내용과 공개 설정을 확인한 후 저장해주세요.' : '수정할 공지를 선택하거나 새 공지를 작성하세요.'}</p>
          </div>
          {!editing && <Button className="admin-primary" onClick={() => start(null)}><Plus size={16} /> 새 공지</Button>}
        </header>
        {error && <div className="admin-notice" role="alert">{error}
          {!editing && <Button variant="outline" onClick={() => { setError(''); setLoading(true); setReload(value => value + 1); }}>다시 시도</Button>}
        </div>}
        {message && <p className="admin-notice" role="status">{message}</p>}
        {!editing ? (
          <section className="admin-panel" aria-label="공지 목록">
            <p className="admin-muted">전체 {items.length}개 · 홈 노출 {items.filter(item => item.is_published && item.show_in_banner).length}개</p>
            {loading ? <p role="status">공지를 불러오는 중입니다.</p>
              : !items.length && !error ? <p className="admin-muted">아직 작성된 공지가 없습니다. 새 공지를 작성해주세요.</p>
              : <ul className="admin-list">{items.map(item => (
                <li key={item.id}>
                  <div className="admin-list-copy">
                    <span className="admin-badge" data-visible={item.is_published && item.show_in_banner}>
                      {item.is_published && item.show_in_banner ? '홈에 표시 중' : '홈에 표시 안 함'}
                    </span>
                    <h2>{item.title}</h2><p>{item.banner_text || item.title}</p>
                    <p>표시 순서 {item.display_order} · 수정 {new Date(item.updated_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <Button variant="outline" onClick={() => start(item)} aria-label={item.title + ' 수정'}><Pencil size={16} /> 수정</Button>
                </li>
              ))}</ul>}
          </section>
        ) : (
          <form onSubmit={event => void save(event)}>
            <fieldset disabled={saving} className="admin-fields">
              <div className="admin-editor">
                <section className="admin-panel admin-fields" aria-label="공지 내용">
                  <h2>공지 내용</h2>
                  <label className="admin-field">제목
                    <input required maxLength={150} value={form.title} onChange={event => update('title', event.target.value)} autoFocus />
                  </label>
                  <label className="admin-field">홈 배너 문구
                    <textarea required maxLength={300} rows={3} value={form.banner_text} onChange={event => update('banner_text', event.target.value)} />
                    <span className="admin-muted">{form.banner_text.length} / 300자 · 홈에서 순환 표시되는 문구입니다.</span>
                  </label>
                  <label className="admin-field">메모 (선택)
                    <textarea rows={6} value={form.content} onChange={event => update('content', event.target.value)} />
                    <span className="admin-muted">비워 두어도 저장할 수 있습니다. 홈 배너에는 표시되지 않지만, 비밀 정보는 입력하지 마세요.</span>
                  </label>
                </section>
                <aside className="admin-panel admin-fields" aria-label="공개 설정">
                  <h2>공개 설정</h2>
                  <label className="admin-toggle"><input type="checkbox" checked={form.is_published && form.show_in_banner} onChange={event => {
                    const visible = event.target.checked;
                    setForm(previous => ({ ...previous, is_published: visible, show_in_banner: visible }));
                  }} /><span>홈에 공지 표시<br /><span className="admin-muted">켜고 저장하면 홈 배너에 표시됩니다. 끄고 저장하면 비공개로 보관합니다.</span></span></label>
                  <label className="admin-field">배너 표시 순서
                    <input type="number" required min={0} max={2147483647} step={1} value={form.display_order} onChange={event => update('display_order', event.target.valueAsNumber)} />
                    <span className="admin-muted">작은 숫자가 먼저 표시됩니다.</span>
                  </label>
                  <h2>배너 미리보기</h2>
                  <div className="admin-preview">{form.banner_text.trim() || '배너 문구를 입력해주세요.'}</div>
                  <p className="admin-muted">{form.is_published && form.show_in_banner ? '저장하면 홈 배너에 노출됩니다.' : '현재 설정으로 저장하면 홈 배너에 노출되지 않습니다.'}</p>
                </aside>
              </div>
              <div className="admin-actions">
                <Button type="submit" className="admin-primary">{saving ? '저장 중…' : '변경사항 저장'}</Button>
                <Button type="button" variant="outline" onClick={cancel}>목록으로</Button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </main>
  );
}
