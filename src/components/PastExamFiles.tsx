import { Download, ExternalLink, FileText } from 'lucide-react';
import type { PastExamDocument } from '../types/pastExam';

export function PastExamFiles({ documents }: { documents: PastExamDocument[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-600">문제지 PDF 준비 중입니다. 정답표는 아래에서 확인할 수 있습니다.</p>;
  }

  return (
    <ul className="space-y-3">
      {documents.map(document => (
        <li key={document.url} className="past-exam-file">
          <div>
            <p className="text-sm font-semibold text-gray-900">{document.title}</p>
            <p className="text-xs text-gray-500">PDF{document.sizeLabel ? ` · ${document.sizeLabel}` : ''}</p>
          </div>
          <div className="past-exam-file-actions">
            <a className="past-exam-link" href={document.url} target="_blank" rel="noopener noreferrer">
              <FileText size={16} aria-hidden="true" /> PDF 열기<span className="sr-only"> (새 탭)</span>
            </a>
            <a className="past-exam-link" href={document.url} download={document.fileName}>
              <Download size={16} aria-hidden="true" /> 다운로드
            </a>
            {document.sourceUrl && (
              <a className="past-exam-link" href={document.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" /> 출처<span className="sr-only"> (새 탭)</span>
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
