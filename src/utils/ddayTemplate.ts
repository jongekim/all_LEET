export const TEMPLATE_MAX_LENGTH = 100;

export function templateError(value: string): string | null {
  if (Array.from(value).some(char => {
    const code = char.codePointAt(0)!;
    return code <= 31 || (code >= 127 && code <= 159) || code === 8232 || code === 8233;
  })) return '문구에는 줄바꿈·탭·제어 문자를 넣을 수 없습니다.';
  const template = value.trim();
  if (!template) return '표시 문구를 입력해주세요.';
  if (Array.from(template).length > TEMPLATE_MAX_LENGTH) return '표시 문구는 100자 이하로 입력해주세요.';
  if (/[{}]/u.test(template.replace(/\{date\}|\{dday\}/gu, ''))) {
    return '치환자는 {date}와 {dday}만 사용할 수 있습니다. 중괄호를 확인해주세요.';
  }
  return null;
}

export function renderDdayTemplate(template: string, date: string, dday: string): string {
  const error = templateError(template);
  if (error) throw new Error(error);
  return template.trim().replace(/\{date\}|\{dday\}/gu, token => token === '{date}' ? date : dday);
}
