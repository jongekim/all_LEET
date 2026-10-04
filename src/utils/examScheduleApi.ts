import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../contexts/AuthContext';
import type { ExamSchedule, ExamScheduleForm } from '../types/examSchedule';
import { normalizeScheduleForm, parseExamSchedule, sameScheduleForm } from './examScheduleModel';

export const SCHEDULE_COLUMNS = 'key,exam_date,display_template,revision,updated_at';
export type ScheduleErrorKind = 'unavailable' | 'missing' | 'invalid' | 'authorization' | 'conflict' | 'unknown';

export class ExamScheduleError extends Error {
  constructor(public kind: ScheduleErrorKind, message: string, public current: ExamSchedule | null = null) {
    super(message);
    this.name = 'ExamScheduleError';
  }
}

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, external?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (external?.aborted) controller.abort();
  external?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  let rejectAbort: () => void = () => {};
  try {
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(new DOMException('Aborted', 'AbortError'));
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
    });
    return await Promise.race([operation(controller.signal), interrupted]);
  } finally {
    clearTimeout(timeout);
    external?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', rejectAbort);
  }
}

export function createExamScheduleApi(client: SupabaseClient) {
  async function read(signal?: AbortSignal): Promise<ExamSchedule> {
    return bounded(async requestSignal => {
      const result = await client.from('exam_schedule').select(SCHEDULE_COLUMNS).eq('key', 'leet').abortSignal(requestSignal).maybeSingle();
      if (result.error) throw new ExamScheduleError('unavailable', '디데이 설정을 불러오지 못했습니다. 다시 시도해주세요.');
      if (!result.data) throw new ExamScheduleError('missing', '디데이 설정이 없습니다. DB 초기 설정을 확인해주세요.');
      try { return parseExamSchedule(result.data); }
      catch { throw new ExamScheduleError('invalid', '디데이 설정 응답이 올바르지 않습니다.'); }
    }, signal);
  }

  async function assertOwner(ownerId: string, signal: AbortSignal) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const { data, error } = await client.auth.getSession();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error || data.session?.user.id !== ownerId) {
      throw new ExamScheduleError('authorization', '로그인 상태가 변경되었습니다. 관리자 권한을 다시 확인해주세요.');
    }
  }

  async function assertAdmin(ownerId: string, signal?: AbortSignal) {
    return bounded(async requestSignal => {
      await assertOwner(ownerId, requestSignal);
      const result = await client.rpc('current_user_is_admin').abortSignal(requestSignal);
      await assertOwner(ownerId, requestSignal);
      if (result.error || result.data !== true) {
        throw new ExamScheduleError('authorization', '관리자 권한을 확인하지 못했습니다. 로그인 상태와 권한을 확인해주세요.');
      }
    }, signal);
  }

  async function save(input: ExamScheduleForm, base: ExamSchedule, ownerId: string, signal?: AbortSignal): Promise<ExamSchedule> {
    const form = normalizeScheduleForm(input);
    return bounded(async requestSignal => {
      await assertOwner(ownerId, requestSignal);
      const result = await client.from('exam_schedule').update(form).eq('key', 'leet').eq('revision', base.revision)
        .select(SCHEDULE_COLUMNS).abortSignal(requestSignal).maybeSingle();
      await assertOwner(ownerId, requestSignal);
      if (result.error) {
        if (result.error.code === '42501' || result.status === 401 || result.status === 403) {
          throw new ExamScheduleError('authorization', '디데이 설정을 수정할 권한이 없습니다.');
        }
        if (result.error.code === '23514' || result.error.code === '22007' || result.error.code === '22008') {
          throw new ExamScheduleError('invalid', '날짜와 표시 문구를 확인해주세요.');
        }
        throw new ExamScheduleError('unknown', '저장 결과를 확인하지 못했습니다. 현재 서버 설정을 확인해주세요.');
      }
      if (!result.data) {
        // The public row is visible even after role revocation; verify both facts.
        const [current] = await Promise.all([read(requestSignal), assertAdmin(ownerId, requestSignal)]);
        throw new ExamScheduleError('conflict', '다른 관리자가 디데이 설정을 변경했습니다. 최신 값을 확인해주세요.', current);
      }
      let saved: ExamSchedule;
      try { saved = parseExamSchedule(result.data); }
      catch { throw new ExamScheduleError('unknown', '저장 응답을 확인하지 못했습니다. 현재 서버 설정을 확인해주세요.'); }
      const expectedRevision = base.revision + (sameScheduleForm(form, base) ? 0 : 1);
      if (!sameScheduleForm(saved, form) || saved.revision !== expectedRevision) {
        throw new ExamScheduleError('unknown', '저장 응답이 예상과 다릅니다. 현재 서버 설정을 확인해주세요.');
      }
      return saved;
    }, signal);
  }

  return { read, save, assertAdmin };
}

export type ExamScheduleApi = ReturnType<typeof createExamScheduleApi>;
export const examScheduleApi = createExamScheduleApi(supabase);
