import type { DataMember } from '../../supabase/functions/_shared/user-data-contract';
const count = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? `${value}회` : '확인 불가';
export function userDataMemberLabel(member: DataMember) {
  const name = `${member.name || '이름 없음'}${member.is_deleted ? ' (탈퇴 회원)' : ''}`;
  return `${name} · 채점 ${count(member.grading_count)} · 사설 ${count(member.mock_count)} · ${member.email || '탈퇴한 계정'}`;
}
