import { useEffect, useMemo, useState } from 'react';
import { Check, FilePlus2, Loader2, Pencil, Save, X } from 'lucide-react';
import { supabase } from '../contexts/AuthContext';
import type { Announcement, AnnouncementForm } from '../types/announcement';
import { Button } from '../components/ui/button';

const emptyForm: AnnouncementForm = {
  title: '',
  content: '',
  banner_text: '',
  is_published: false,
  show_in_banner: true,
  display_order: 0,
};

const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const makeSlug = () => `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === selectedId) ?? null,
    [announcements, selectedId],
  );

  const loadAnnouncements = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('home_announcements')
      .select('id,slug,title,content,banner_text,is_published,show_in_banner,display_order,created_at,updated_at')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('공지 목록을 불러오지 못했습니다.', error);
      alert('공지 목록을 불러오지 못했습니다. 관리자 권한을 확인해주세요.');
      setAnnouncements([]);
    } else {
      setAnnouncements((data ?? []) as Announcement[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const startNew = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const startEdit = (announcement: Announcement) => {
    setSelectedId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      banner_text: announcement.banner_text,
      is_published: announcement.is_published,
      show_in_banner: announcement.show_in_banner,
      display_order: announcement.display_order,
    });
  };

  const updateField = <Key extends keyof AnnouncementForm>(key: Key, value: AnnouncementForm[Key]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    const bannerText = form.banner_text.trim();

    if (!title || !content || !bannerText) {
      alert('제목, 본문, 배너 문구를 모두 입력해주세요.');
      return;
    }

    setIsSaving(true);
    const payload = {
      title,
      content,
      banner_text: bannerText,
      is_published: form.is_published,
      show_in_banner: form.show_in_banner,
      display_order: form.display_order,
      updated_at: new Date().toISOString(),
    };

    const result = selectedAnnouncement
      ? await supabase.from('home_announcements').update(payload).eq('id', selectedAnnouncement.id)
      : await supabase.from('home_announcements').insert({ ...payload, slug: makeSlug() });

    if (result.error) {
      console.error('공지 저장에 실패했습니다.', result.error);
      alert('공지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setIsSaving(false);
      return;
    }

    await loadAnnouncements();
    setIsSaving(false);
    alert(selectedAnnouncement ? '공지를 수정했습니다.' : '새 공지를 저장했습니다.');
    startNew();
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">ALL LEET 운영</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">공지 관리</h1>
            <p className="mt-2 text-sm text-slate-600">발행된 공지 중 홈 배너 표시를 켠 항목만 홈 화면에 노출됩니다.</p>
          </div>
          <Button type="button" onClick={startNew} className="gap-2 self-start sm:self-auto">
            <FilePlus2 className="h-4 w-4" /> 새 공지
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-slate-900">공지 목록</h2>
            </div>
            {isLoading ? (
              <div className="flex min-h-52 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 불러오는 중
              </div>
            ) : announcements.length === 0 ? (
              <div className="min-h-52 px-5 py-12 text-center text-sm text-slate-500">작성된 공지가 없습니다.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {announcements.map((announcement) => (
                  <li key={announcement.id} className="px-5 py-4">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-900">{announcement.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${announcement.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {announcement.is_published ? '발행됨' : '비공개'}
                          </span>
                          {announcement.show_in_banner && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">홈 배너</span>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{announcement.banner_text || announcement.title}</p>
                        <p className="mt-2 text-xs text-slate-400">우선순위 {announcement.display_order} · 수정 {formatDate(announcement.updated_at)}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => startEdit(announcement)} className="shrink-0 gap-1">
                        <Pencil className="h-3.5 w-3.5" /> 수정
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-900">{selectedAnnouncement ? '공지 수정' : '새 공지 작성'}</h2>
              {selectedAnnouncement && (
                <button type="button" onClick={startNew} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                  <X className="h-4 w-4" /> 새로 작성
                </button>
              )}
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                제목
                <input value={form.title} onChange={(event) => updateField('title', event.target.value)} maxLength={150} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                홈 배너 문구 <span className="font-normal text-slate-400">(최대 300자)</span>
                <input value={form.banner_text} onChange={(event) => updateField('banner_text', event.target.value)} maxLength={300} className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                본문
                <textarea value={form.content} onChange={(event) => updateField('content', event.target.value)} rows={8} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                배너 표시 순서 <span className="font-normal text-slate-400">(작을수록 먼저 표시)</span>
                <input type="number" min="0" value={form.display_order} onChange={(event) => updateField('display_order', Math.max(0, Number(event.target.value) || 0))} className="mt-1.5 w-28 rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2" />
              </label>
              <div className="space-y-3 rounded-lg bg-slate-50 p-3">
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.is_published} onChange={(event) => updateField('is_published', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span><strong className="text-slate-900">공지 발행</strong> — 사용자에게 공개합니다.</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.show_in_banner} onChange={(event) => updateField('show_in_banner', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span><strong className="text-slate-900">홈 배너에 표시</strong> — 발행된 경우에만 홈에 노출됩니다.</span>
                </label>
              </div>
              <Button type="button" onClick={() => void handleSave()} disabled={isSaving} className="w-full gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {selectedAnnouncement ? '변경사항 저장' : '공지 저장'}
              </Button>
              {selectedAnnouncement?.is_published && selectedAnnouncement.show_in_banner && <p className="flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" /> 현재 홈 배너에 표시 중입니다.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
