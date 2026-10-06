import { expect, it } from 'vitest';
import { userDataMemberLabel } from './userDataMemberLabel';
import type { DataMember } from '../../supabase/functions/_shared/user-data-contract';
const member: DataMember = { user_id: 'private-uid', name: '홍길동', email: 'hong@example.test', created_at: null, grading_count: 12, mock_count: 3 };
it('hides UID while displaying server counts including zero', () => {
  expect(userDataMemberLabel(member)).toBe('홍길동 · 채점 12회 · 사설 3회 · hong@example.test');
  expect(userDataMemberLabel({ ...member, grading_count: 0, mock_count: 0 })).toContain('채점 0회 · 사설 0회');
  expect(userDataMemberLabel(member)).not.toContain(member.user_id);
});
it('does not present unavailable or malformed counts as zero', () => {
  expect(userDataMemberLabel({ ...member, grading_count: null, mock_count: -1 })).toContain('채점 확인 불가 · 사설 확인 불가');
});
it('marks departed members without hiding retained display information', () => {
  expect(userDataMemberLabel({ ...member, is_deleted: true })).toBe('홍길동 (탈퇴 회원) · 채점 12회 · 사설 3회 · hong@example.test');
  expect(userDataMemberLabel({ ...member, is_deleted: true })).not.toContain(member.user_id);
});
