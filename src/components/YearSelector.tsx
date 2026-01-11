import { Year } from '../App';

const YEARS = [
  '09예비', '2009', '2010', '2011', '2012', '2013', '2014', '2015', '2016',
  '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'
];

interface YearSelectorProps {
  selectedYear: Year;
  onYearChange: (year: Year) => void;
}

export function YearSelector({ selectedYear, onYearChange }: YearSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        시험 학년도
      </label>
      <select
        value={selectedYear}
        onChange={(e) => onYearChange(e.target.value)}
        className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
      >
        {YEARS.map((year) => (
          <option key={year} value={year}>
            {year === '09예비' ? '09학년도예비' : `${year}학년도`}
          </option>
        ))}
      </select>
    </div>
  );
}