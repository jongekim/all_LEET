import { Download, FileText, ArrowUpRight } from 'lucide-react';
import type { PastExamDocument } from '../types/pastExam';
import { usageAnalytics } from '../utils/usageAnalytics';

export function PastExamFiles({ documents }: { documents: PastExamDocument[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-600">선택한 유형의 문제지는 아직 준비 중입니다.</p>;
  }

  return (
    <ul className="past-exam-file-list">
      {documents.map(document => (
        <li key={document.url} className="past-exam-file">
          <div className="past-exam-file-info">
            <span className="past-exam-file-icon"><FileText size={24} aria-hidden="true" /></span>
            <div>
              <p className="past-exam-file-title">{document.title}</p>
              <p className="past-exam-file-meta">PDF{document.sizeLabel ? ` · ${document.sizeLabel}` : ''}</p>
            </div>
          </div>
          <div className="past-exam-file-actions">
            <a className="past-exam-link" href={document.url} target="_blank" rel="noopener noreferrer" onClick={() => usageAnalytics().track('past_exam_file_clicked', 'past_exams', { year: document.year, subjects: document.subject, exam_type: document.examType, target_type: 'pdf', target_id: `${document.year}:${document.subject}:${document.examType}` })}>
              <ArrowUpRight size={16} aria-hidden="true" /> PDF 열기<span className="sr-only"> (새 탭)</span>
            </a>
            <a className="past-exam-link past-exam-download" href={`${document.url}?download=${encodeURIComponent(document.fileName)}`} download={document.fileName} onClick={() => usageAnalytics().track('past_exam_file_clicked', 'past_exams', { year: document.year, subjects: document.subject, exam_type: document.examType, target_type: 'pdf', target_id: `${document.year}:${document.subject}:${document.examType}` })}>
              <Download size={16} aria-hidden="true" /> 다운로드
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
