export interface LawSchool {
  id: string;
  name: string;
  region: 'SKY' | '인서울대형' | '인서울미니' | '수도권' | '지방거점국립대' | '지방';
  
  // 학교별 합격 기준 (Raw Data)
  standardScore: {
    leet: number; // 예: 140
    gpa: number;  // 예: 96
  };
  minimumScore: {
    leet: number; // 예: 135
    gpa: number;  // 예: 92
  };

  // ✅ 핵심: 1점당 환산 배점 (사용자가 직접 입력/수정하기 쉬움)
  conversionFactor: {
    leetPerPoint: number; // 리트 1점당 환산점수
    gpaPerPoint: number;  // GPA 1점당 환산점수
    baseScore?: number;   // 기본점수 (옵션, 없으면 0)
  };
}

export const lawSchools: LawSchool[] = [
  {
    id: 'snu',
    name: '서울대학교',
    region: 'SKY',
    standardScore: { leet: 145, gpa: 98 },
    minimumScore: { leet: 141, gpa: 96 },
    conversionFactor: { 
      leetPerPoint: 0.5, // 리트 1점 올려봐야 환산점수 0.6점 상승
      gpaPerPoint: 0.6,  // 학점 1점 올리면 환산점수 1.2점 상승
    },
  },
  {
    id: 'korea',
    name: '고려대학교',
    region: 'SKY',
    standardScore: { leet: 144, gpa: 97 },
    minimumScore: { leet: 139, gpa: 95 },
    conversionFactor: { 
      leetPerPoint: 0.2, 
      gpaPerPoint: 0.4, 
    },
  },
  {
    id: 'yonsei',
    name: '연세대학교',
    region: 'SKY',
    standardScore: { leet: 137, gpa: 98 },
    minimumScore: { leet: 133, gpa: 97 },
    conversionFactor: { 
      leetPerPoint: 0.3, 
      gpaPerPoint: 1, 
    },
  },
  {
    id: 'chungang',
    name: '중앙대학교',
    region: '인서울미니',
    standardScore: { leet: 126, gpa: 98 },
    minimumScore: { leet: 122, gpa: 97 },
    conversionFactor: { 
      leetPerPoint: 0.2, 
      gpaPerPoint: 0.33, 
    },
  },
  {
    id: 'skku',
    name: '성균관대학교',
    region: '인서울대형',
    standardScore: { leet: 135, gpa: 96 },
    minimumScore: { leet: 131, gpa: 94 },
    conversionFactor: { 
      leetPerPoint: 0.04, 
      gpaPerPoint: 0.05, 
    },
  },
  {
    id: 'ihwa',
    name: '이화여자대학교',
    region: '인서울대형',
    standardScore: { leet: 131, gpa: 97 },
    minimumScore: { leet: 128, gpa: 96 },
    conversionFactor: { 
      leetPerPoint: 0.7, 
      gpaPerPoint: 0.89, 
    },
  },
  {
    id: 'hanyang',
    name: '한양대학교',
    region: '인서울대형',
    standardScore: { leet: 141, gpa: 94 },
    minimumScore: { leet: 135, gpa: 91 },
    conversionFactor: { 
      leetPerPoint: 0.7, 
      gpaPerPoint: 0.7, 
    },
  },
  {
    id: 'koreaforeign',
    name: '한국외국어대학교',
    region: '인서울미니',
    standardScore: { leet: 133, gpa: 96 },
    minimumScore: { leet: 129, gpa: 92 },
    conversionFactor: { 
      leetPerPoint: 0.67, 
      gpaPerPoint: 0.45, 
    },
  },
  {
    id: 'kyounghee',
    name: '경희대학교',
    region: '인서울미니',
    standardScore: { leet: 138, gpa: 95 },
    minimumScore: { leet: 133, gpa: 93 },
    conversionFactor: { 
      leetPerPoint: 0.28, 
      gpaPerPoint: 0.15, 
    },
  },
  {
    id: 'seoulcity',
    name: '서울시립대학교',
    region: '인서울미니',
    standardScore: { leet: 135, gpa: 95 },
    minimumScore: { leet: 131, gpa: 92 },
    conversionFactor: { 
      leetPerPoint: 0.2, 
      gpaPerPoint: 0.1, 
    },
  },
  {
    id: 'jeonnam',
    name: '전남대학교',
    region: '지방거점국립대',
    standardScore: { leet: 128, gpa: 96 },
    minimumScore: { leet: 124, gpa: 94 },
    conversionFactor: { 
      leetPerPoint: 1, 
      gpaPerPoint: 0.775, 
    },
  },
  {
    id: 'seogang',
    name: '서강대학교',
    region: '인서울미니',
    standardScore: { leet: 133, gpa: 93 },
    minimumScore: { leet: 124, gpa: 90 },
    conversionFactor: { 
      leetPerPoint: 0.1, 
      gpaPerPoint: 0.05, 
    },
  },
  {
    id: 'aju',
    name: '아주대학교',
    region: '수도권',
    standardScore: { leet: 127, gpa: 95 },
    minimumScore: { leet: 124, gpa: 93 },
    conversionFactor: { 
      leetPerPoint: 0.1, 
      gpaPerPoint: 0.13, 
    },
  },
  {
    id: 'busan',
    name: '부산대학교',
    region: '지방거점국립대',
    standardScore: { leet: 128, gpa: 97 },
    minimumScore: { leet: 126, gpa: 96 },
    conversionFactor: { 
      leetPerPoint: 0.3, 
      gpaPerPoint: 0.25, 
    },
  },
  {
    id: 'youngnam',
    name: '영남대학교',
    region: '지방',
    standardScore: { leet:119 , gpa: 96 },
    minimumScore: { leet: 115, gpa:  94},
    conversionFactor: { 
      leetPerPoint: 0.67, 
      gpaPerPoint: 1, 
    },
  },
  {
    id: 'inha',
    name: '인하대학교',
    region: '수도권',
    standardScore: { leet: 125, gpa: 94},
    minimumScore: { leet: 122, gpa: 90 },
    conversionFactor: { 
      leetPerPoint: 1.22, 
      gpaPerPoint: 0.5, 
    },
  },
  {
    id: 'chungnam',
    name: '충남대학교',
    region: '지방거점국립대',
    standardScore: { leet: 124, gpa: 98 },
    minimumScore: { leet: 120, gpa: 97 },
    conversionFactor: { 
      leetPerPoint: 0.7, 
      gpaPerPoint: 1, 
    },
  },
  {
    id: 'konkuk',
    name: '건국대학교',
    region: '인서울미니',
    standardScore: { leet: 133, gpa: 97 },
    minimumScore: { leet: 130, gpa:  95},
    conversionFactor: { 
      leetPerPoint: 1.5, 
      gpaPerPoint: 1.67, 
    },
  },
  {
    id: 'kyoungbuk',
    name: '경북대학교',
    region: '지방거점국립대',
    standardScore: { leet: 127, gpa: 95 },
    minimumScore: { leet: 124, gpa: 92 },
    conversionFactor: { 
      leetPerPoint: 0.43, 
      gpaPerPoint: 0.35, 
    },
  },
  {
    id: 'jeonbuk',
    name: '전북대학교',
    region: '지방거점국립대',
    standardScore: { leet: 123, gpa: 95 },
    minimumScore: { leet: 120, gpa:  93},
    conversionFactor: { 
      leetPerPoint: 0.48, 
      gpaPerPoint: 1.1, 
    },
  },
  {
    id: 'chungbuk',
    name: '충북대학교',
    region: '지방거점국립대',
    standardScore: { leet: 132, gpa: 91 },
    minimumScore: { leet: 128, gpa: 87 },
    conversionFactor: { 
      leetPerPoint: 1.3, 
      gpaPerPoint: 0.26, 
    },
  },
  {
    id: 'kangwon',
    name: '강원대학교',
    region: '지방거점국립대',
    standardScore: { leet: 125, gpa: 95 },
    minimumScore: { leet: 122, gpa: 93},
    conversionFactor: { 
      leetPerPoint: 2, 
      gpaPerPoint: 1.5, 
    },
  },
  {
    id: 'jeju',
    name: '제주대학교',
    region: '지방거점국립대',
    standardScore: { leet: 120, gpa: 97 },
    minimumScore: { leet: 118, gpa:  96},
    conversionFactor: { 
      leetPerPoint: 0.2, 
      gpaPerPoint: 0.4, 
    },
  },
  {
    id: 'donga',
    name: '동아대학교',
    region: '지방',
    standardScore: { leet: 124, gpa: 92 },
    minimumScore: { leet: 120, gpa: 88 },
    conversionFactor: { 
      leetPerPoint: 0.5, 
      gpaPerPoint: 1.5, 
    },
  },
  {
    id: 'wongwang',
    name: '원광대학교',
    region: '지방',
    standardScore: { leet: 120, gpa: 98 },
    minimumScore: { leet: 118, gpa: 97 },
    conversionFactor: { 
      leetPerPoint: 0.14, 
      gpaPerPoint: 0.2, 
    },
  },


];

export type AdmissionChance = '적정' | '소신' | '불가';

export interface LawSchoolAnalysis {
  school: LawSchool;
  myTotalScore: number; // 나의 총 환산점수
  cutlineScore: number; // 학교의 적정 커트라인 환산점수
  chance: AdmissionChance;
  gap: number; // 커트라인과의 점수 차이
}

export function analyzeLawSchools(
  leet: number,
  gpa: number
): LawSchoolAnalysis[] {
  const analyses: LawSchoolAnalysis[] = lawSchools.map(school => {
    const { leetPerPoint, gpaPerPoint, baseScore = 0 } = school.conversionFactor;

    // 1. 내 점수 환산 계산 (단순 곱하기 + 더하기)
    // 공식: (내리트 * 리트배점) + (내학점 * 학점배점) + 기본점수
    const rawMyScore = (leet * leetPerPoint) + (gpa * gpaPerPoint) + baseScore;

    // 2. 학교 기준(Standard) 점수 환산 계산
    const rawStandardScore = (school.standardScore.leet * leetPerPoint) + 
                             (school.standardScore.gpa * gpaPerPoint) + baseScore;

    // 3. 학교 최저(Minimum) 점수 환산 계산
    const rawMinScore = (school.minimumScore.leet * leetPerPoint) + 
                        (school.minimumScore.gpa * gpaPerPoint) + baseScore;

    // 4. 합격 가능성 판정
    let chance: AdmissionChance;
    if (rawMyScore >= rawStandardScore) {
      chance = '적정';
    } else if (rawMyScore >= rawMinScore) {
      chance = '소신';
    } else {
      chance = '불가';
    }

    // 5. 점수 및 차이 계산 (소수점 한 자리 처리)
    const myTotalScore = Math.round(rawMyScore * 10) / 10;
    const cutlineScore = Math.round(rawStandardScore * 10) / 10;
    const gap = Math.round((myTotalScore - cutlineScore) * 10) / 10;

    return {
      school,
      myTotalScore,
      cutlineScore,
      chance,
      gap // 양수면 여유, 음수면 부족
    };
  });

  // 점수 차이가 큰 순서(여유 있는 순서)로 정렬
  return analyses.sort((a, b) => b.gap - a.gap);
}

export function getSchoolsByChance(analyses: LawSchoolAnalysis[]) {
  const moderate = analyses.filter(a => a.chance === '적정');
  const reach = analyses.filter(a => a.chance === '소신');
  const impossible = analyses.filter(a => a.chance === '불가');
  
  return { moderate, reach, impossible };
}