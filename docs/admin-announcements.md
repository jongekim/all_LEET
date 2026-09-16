# 관리자 공지 운영

관리자 공지 화면은 `/admin/announcements`다. 로그인하지 않았거나 관리자 역할이 없는 사용자는 홈으로 이동한다. 이 화면의 접근 차단은 UI만의 기능이 아니며, `home_announcements`의 RLS 정책이 관리자 역할을 다시 확인한다.

## 최초 관리자 지정

마이그레이션은 보안을 위해 관리자 계정을 자동으로 만들지 않는다. Supabase Dashboard의 Authentication > Users에서 운영자 계정의 UUID를 확인한 뒤, 권한 있는 SQL Editor에서 다음의 `운영자_UUID`만 실제 값으로 바꿔 실행한다.

```sql
insert into private.admin_roles (user_id, role)
values ('운영자_UUID', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

권한을 부여한 계정으로 로그인한 뒤 `/admin/announcements`에 접속한다. 역할 부여 SQL과 service role 키는 브라우저 코드나 환경 변수에 넣지 않는다.

## 공지 노출 규칙

- `공지 발행`을 켜야 일반 사용자가 공지를 볼 수 있다.
- `홈 배너에 표시`를 켠 발행 공지만 홈 배너에서 순환 노출된다.
- 배너 표시 순서가 작은 공지가 먼저 표시되며, 순서가 같으면 최신 공지가 먼저 표시된다.
- 비공개로 전환하면 공지를 삭제하지 않고 즉시 사용자 화면에서 숨긴다.

공지 작성·수정은 운영 DB를 변경하므로 운영자 계정에서만 수행한다. 실제 입력 검증은 운영과 분리된 Supabase 환경에서 우선 수행한다.
