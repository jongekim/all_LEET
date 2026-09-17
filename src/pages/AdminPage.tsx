import { PageHeader } from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone } from 'lucide-react';
import '../styles/admin.css';

export function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="관리자 페이지" description="관리할 항목을 선택해주세요." />
      <main className="admin-shell">
        <div className="admin-container">
          <Link to="/admin/announcements" className="admin-menu-card">
            <Megaphone size={28} />
            <div><h2>공지 관리</h2><p>공지를 작성·수정하고 홈 배너 노출과 순서를 설정합니다.</p></div>
            <ArrowRight size={20} />
          </Link>
        </div>
      </main>
    </div>
  );
}
