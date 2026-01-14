import * as React from "react";

import { ChevronDown, ChevronUp, Info, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type ToeicInfo = {
  schoolName: string;
  minimumRequirement: string;
  topTierScore: string;
};

const TOEIC_INFOS: ToeicInfo[] = [
  { schoolName: "강원대학교", minimumRequirement: "720", topTierScore: "P/F" },
  { schoolName: "건국대학교", minimumRequirement: "800", topTierScore: "P/F" },
  { schoolName: "경북대학교", minimumRequirement: "800", topTierScore: "P/F" },
  { schoolName: "경희대학교", minimumRequirement: "800", topTierScore: "P/F" },
  { schoolName: "고려대학교", minimumRequirement: "815", topTierScore: "P/F" },

  { schoolName: "동아대학교", minimumRequirement: "600", topTierScore: "P/F" },
  { schoolName: "부산대학교", minimumRequirement: "700", topTierScore: "P/F" },
  { schoolName: "서강대학교", minimumRequirement: "700", topTierScore: "P/F" },
  { schoolName: "서울대학교", minimumRequirement: "387 (TEPS)", topTierScore: "P/F" },
  { schoolName: "서울시립대학교", minimumRequirement: "제한 없음", topTierScore: "935" },

  { schoolName: "성균관대학교", minimumRequirement: "830", topTierScore: "P/F" },
  { schoolName: "아주대학교", minimumRequirement: "제한 없음", topTierScore: "900" },
  { schoolName: "연세대학교", minimumRequirement: "850", topTierScore: "P/F" },
  { schoolName: "영남대학교", minimumRequirement: "600", topTierScore: "950" },
  { schoolName: "원광대학교", minimumRequirement: "제한 없음", topTierScore: "950" },

  { schoolName: "이화여자대학교", minimumRequirement: "제한 없음", topTierScore: "975" },
  { schoolName: "인하대학교", minimumRequirement: "제한 없음", topTierScore: "990" },
  { schoolName: "전남대학교", minimumRequirement: "750", topTierScore: "P/F" },
  { schoolName: "전북대학교", minimumRequirement: "700", topTierScore: "P/F" },
  { schoolName: "제주대학교", minimumRequirement: "710", topTierScore: "P/F" },

  { schoolName: "중앙대학교", minimumRequirement: "700", topTierScore: "965" },
  { schoolName: "충남대학교", minimumRequirement: "750", topTierScore: "850" },
  { schoolName: "충북대학교", minimumRequirement: "750", topTierScore: "P/F" },
  { schoolName: "한국외국어대학교", minimumRequirement: "700", topTierScore: "900" },
  { schoolName: "한양대학교", minimumRequirement: "800", topTierScore: "P/F" },
];

export function ToeicInfoNotice() {
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef(null);
  const panelId = "toeic-info-panel";

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      requestAnimationFrame(() => {
        (panelRef.current as any)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full rounded-xl p-4 sm:p-5 text-left transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-200 bg-gradient-to-r from-blue-50 to-white border-2 border-blue-200 hover:border-blue-300"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-blue-200 text-blue-700">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm sm:text-base font-semibold text-gray-900">
                    {open ? "학교별 토익/TEPS 관련 정보 닫기" : "학교별 토익/TEPS 관련 정보 보기"}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-white text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-semibold">
                    25개교
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                  최저요건과 최고급간 점수를 한 번에 확인하세요.
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
              {open ? "닫기" : "보기"}
            </span>
            {open ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm sm:text-base font-semibold text-gray-900">학교별 토익/TEPS 관련 정보</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:text-gray-700 hover:bg-white/60"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 bg-white border border-blue-200 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대학명</TableHead>
                  <TableHead>최저요건</TableHead>
                  <TableHead>최고급간 점수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TOEIC_INFOS.map((info) => (
                  <TableRow key={info.schoolName} className="odd:bg-muted/30">
                    <TableCell className="font-medium">{info.schoolName}</TableCell>
                    <TableCell>{info.minimumRequirement}</TableCell>
                    <TableCell>{info.topTierScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
