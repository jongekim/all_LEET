import { Subject } from '../App';

interface SubjectTabsProps {
  selectedSubject: Subject;
  onSubjectChange: (subject: Subject) => void;
}

export function SubjectTabs({ selectedSubject, onSubjectChange }: SubjectTabsProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        과목 선택
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => onSubjectChange('verbal')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-colors ${
            selectedSubject === 'verbal'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          언어이해
        </button>
        <button
          onClick={() => onSubjectChange('reasoning')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-colors ${
            selectedSubject === 'reasoning'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          추리논증
        </button>
      </div>
    </div>
  );
}
