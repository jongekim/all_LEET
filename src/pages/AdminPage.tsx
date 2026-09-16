import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Megaphone } from 'lucide-react';
import '../styles/admin.css';

export function AdminPage() {
  return (
    <main className="admin-shell">
      <div className="admin-container">
        <Link className="admin-back" to="/"><ArrowLeft size={16} /> 서비스 홈</Link>
        <header className="admin-heading">
          <div><p className="admin-eyebrow">ALL LEET · 운영</p><h1>관리자 페이지</h1><p>관리할 항목을 선택해주세요.</p></div>
        </header>
        <Link to="/admin/announcements" className="admin-menu-card">
          <Megaphone size={28} />
          <div><h2>공지 관리</h2><p>공지를 작성·수정하고 홈 배너 노출과 순서를 설정합니다.</p></div>
          <ArrowRight size={20} />
        </Link>
      </div>
    </main>
  );
}
