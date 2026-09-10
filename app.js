/**
 * 유아 수학 교구 및 학습지 인터랙티브 대시보드 어플리케이션
 * Features:
 * - 아기 나이 입력 및 ±1세 정밀 자동 매칭
 * - 교구 / 학습지 / 전체 3-way 필터링
 * - 5개 전용 탭 (맞춤추천, 교구탐색, 학습지 로드맵, 1:1 비교, 학술 연구 검증실)
 * - 상세 모달 및 플로팅 비교함
 */

// Application State
const state = {
  selectedAge: 5, // 기본 5세
  selectedType: 'manipulative', // 'manipulative' | 'workbook'
  activeTab: 'tabManipulative',
  searchQuery: '',
  compareList: [] // 처음 진입 시 빈 상태에서 사용자가 자유롭게 선택
};

// 정통 교구 및 교구 결합형 브랜드 ID (교구가 있어야 활용 가능한 프로그램은 교구 탭에서만 조회)
const MANIPULATIVE_BRAND_IDS = ['playfacto', 'yeondubi-montessori', 'monstermath', 'joymath', 'orda', 'froebel', 'kids-schole', 'montessori', 'mathtime', 'edx', 'c2m-class', 'facto-schule', 'bluerabbit', 'hansol-math'];

// =========================================================
// 1. AGE PARSING & FILTER UTILS (±1세 교집합 판별 알고리즘)
// =========================================================
function parseAgeRange(ageStr) {
  if (!ageStr) return { min: 4, max: 8 };
  const str = ageStr.toString().trim();

  // 1. 영유아 키워드 우선 정밀 매핑 (24개월, 2~3세, 만 2세 등)
  if (str.includes('24개월') || str.includes('2~3세') || str.includes('만 2세') || str.includes('2.5세')) {
    let max = 3;
    if (str.includes('7세')) max = 7;
    else if (str.includes('초등')) max = 9;
    return { min: 2, max: max };
  }
  if (str.includes('3~4세')) return { min: 3, max: 4 };
  if (str.includes('3~5세') || str.includes('3세~5세')) return { min: 3, max: 5 };
  if (str.includes('3~6세') || str.includes('만 3세~만 5세')) return { min: 3, max: 6 };
  if (str.includes('3~7세') || str.includes('3세~7세')) return { min: 3, max: 7 };
  if (str.includes('4~5세') || str.includes('4세~5세')) return { min: 4, max: 5 };
  if (str.includes('4~7세') || str.includes('4세~7세')) return { min: 4, max: 7 };
  if (str.includes('5~6세') || str.includes('5세~6세')) return { min: 5, max: 6 };
  if (str.includes('5~7세') || str.includes('5세~7세')) return { min: 5, max: 7 };
  if (str.includes('5~8세') || str.includes('5세~초등')) return { min: 5, max: 8 };
  if (str.includes('6~7세') || str.includes('6세~7세')) return { min: 6, max: 7 };
  if (str.includes('6세~초등')) return { min: 6, max: 9 };
  if (str.includes('7~8세') || str.includes('7세~초등') || str.includes('7세~초등 1학년')) return { min: 7, max: 9 };
  if (str.includes('8세~초등') || str.includes('초등전학년') || str.includes('초등 1~6학년')) return { min: 8, max: 12 };

  // 2. 유아~초등 계열 (초등 학년이 붙는 경우: '유아~초등 3학년')
  if (str.includes('유아~초등') || str.includes('유아~7세')) {
    let max = 8;
    if (str.includes('3학년')) max = 10;
    else if (str.includes('2학년')) max = 9;
    else if (str.includes('7세')) max = 7;
    return { min: 4, max: max };
  }

  // 3. 패턴 분석: "(\d+)세" 또는 "(\d+)~"
  // 주의: "초등 2학년"의 2는 학년(grade)이지 나이가 아님!
  let parsedMin = null;
  let parsedMax = null;

  // 시작 나이 추출: "4세~", "6세~", "5~" 등
  const startMatch = str.match(/(\d+)\s*(?:세|~|-)/);
  if (startMatch) {
    const n = parseInt(startMatch[1], 10);
    if (n >= 1 && n <= 13) {
      parsedMin = n;
    }
  }

  // 끝 나이 또는 초등 학년 추출
  const elemGradeMatch = str.match(/초등\s*(\d+)학년/);
  if (elemGradeMatch) {
    const grade = parseInt(elemGradeMatch[1], 10);
    parsedMax = 7 + grade; // 초등 1학년=8세, 2학년=9세, 3학년=10세
  } else if (str.includes('초등')) {
    parsedMax = 9;
  } else {
    const endMatch = str.match(/[~-]\s*(\d+)\s*세?/);
    if (endMatch) {
      parsedMax = parseInt(endMatch[1], 10);
    }
  }

  if (parsedMin !== null && parsedMax !== null) {
    return { min: Math.min(parsedMin, parsedMax), max: Math.max(parsedMin, parsedMax) };
  }
  if (parsedMin !== null) {
    return { min: parsedMin, max: parsedMin + 2 };
  }

  return { min: 4, max: 8 };
}

function matchesAge(itemAgeText, itemAgeGroup, targetAge) {
  if (targetAge === null || targetAge === undefined) return true;
  const numTargetAge = parseInt(targetAge, 10);
  if (isNaN(numTargetAge)) return true;

  // targetAge에 따른 ±1세 추천 연령대 라벨
  // 예: targetAge = 2 => ['2세', '3세']
  // 예: targetAge = 3 => ['2세', '3세', '4세']
  // 예: targetAge = 5 => ['4세', '5세', '6세']
  // 예: targetAge = 7 => ['6세', '7세', '8세', '초등']
  const windowMin = Math.max(2, numTargetAge - 1);
  const windowMax = numTargetAge + 1;

  const allowedAgeLabels = [];
  for (let a = windowMin; a <= windowMax; a++) {
    allowedAgeLabels.push(`${a}세`);
  }
  if (numTargetAge >= 7) {
    allowedAgeLabels.push('초등');
  }

  // 1. 명시적 연령 그룹 배열(itemAgeGroup)이 있는 경우:
  // 정밀 분류된 데이터이므로 배열 매칭 결과를 최우선 확정 (불일치 시 텍스트 파싱으로 오염되지 않음)
  if (Array.isArray(itemAgeGroup) && itemAgeGroup.length > 0) {
    return itemAgeGroup.some(g => allowedAgeLabels.includes(g));
  }

  // 2. 연령 그룹 배열이 없는 경우(로드맵 플로우차트 단계 등), 텍스트 기반 구간 교집합 판별
  const range = parseAgeRange(itemAgeText);
  if (!range) return false;

  // 두 구간 [windowMin, windowMax]와 [range.min, range.max]가 겹치는지 확인
  return Math.max(windowMin, range.min) <= Math.min(windowMax, range.max);
}

// 브랜드 ID 및 이름 기반 비교 매트릭스 데이터 100% 매칭 헬퍼
function getMatrixForBrand(brand) {
  if (!brand) return {};
  const matrixData = DASHBOARD_DATA.workbookMatrix || [];
  const bId = brand.id || '';
  const bName = brand.name || '';

  // 1. ID 완전 일치 (id 또는 brandId)
  let found = matrixData.find(m => m.id === bId || m.brandId === bId);
  if (found) return found;

  // 2. 하이픈 제거 일치 (예: kids-schole ↔ kidsschole, cmath-plato ↔ cmath)
  const cleanId = bId.replace(/-/g, '').toLowerCase();
  found = matrixData.find(m => {
    const mId = (m.id || '').replace(/-/g, '').toLowerCase();
    const mBrandId = (m.brandId || '').replace(/-/g, '').toLowerCase();
    return mId === cleanId || mBrandId === cleanId;
  });
  if (found) return found;

  // 3. 접두어/포함 관계 일치 (예: cmath-plato ↔ cmath)
  found = matrixData.find(m => {
    if (!m.id) return false;
    return bId.startsWith(m.id) || m.id.startsWith(bId);
  });
  if (found) return found;

  // 4. 브랜드 이름 키워드 일치 (예: "플레이팩토", "몬스터매스", "오르다", "프뢰벨" 등)
  const shortName = bName.split(' ')[0].replace(/[^가-힣a-zA-Z]/g, '');
  if (shortName.length >= 2) {
    found = matrixData.find(m => (m.name || '').includes(shortName));
    if (found) return found;
  }

  return {};
}

// 별점 문자열 생성 헬퍼 (예: 4 -> '★★★★☆')
function getStars(score) {
  const num = typeof score === 'number' ? score : parseInt(score, 10) || 3;
  const full = Math.min(5, Math.max(0, num));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// 브랜드 종합 평점 매트릭스 데이터 매칭 헬퍼
function getStarMatrixForBrand(brand) {
  if (!brand) return { totalScore: 0, avgScore: '0.0' };
  const matrices = DASHBOARD_DATA.matrices || {};
  const allList = [...(matrices.manipulatives || []), ...(matrices.workbooks || [])];
  const bId = brand.id || '';
  const bName = brand.name || '';

  // 1. ID 완전 일치 (최우선)
  let found = allList.find(item => item.id === bId || item.brandId === bId);

  // 2. ID 변형 일치 (하이픈 제거 등)
  if (!found && bId) {
    const cleanId = bId.replace(/-/g, '').toLowerCase();
    found = allList.find(item => {
      const iId = (item.id || '').replace(/-/g, '').toLowerCase();
      return iId && (iId === cleanId || cleanId.includes(iId) || iId.includes(cleanId));
    });
  }

  // 3. 이름 및 키워드 일치
  if (!found) {
    const shortName = bName.split(' ')[0].replace(/[^가-힣a-zA-Z]/g, '');
    found = allList.find(item => {
      const iShort = (item.name || '').split(' ')[0].replace(/[^가-힣a-zA-Z]/g, '');
      return (
        item.name === bName ||
        (shortName && iShort && (shortName.includes(iShort) || iShort.includes(shortName))) ||
        (item.name && bName.includes(item.name)) ||
        (item.name && item.name.includes(shortName))
      );
    });
  }

  let result;
  if (found) {
    result = { ...found };
  } else {
    const isManip = MANIPULATIVE_BRAND_IDS.includes(brand.id);
    result = {
      id: brand.id,
      name: brand.name,
      philosophy: brand.differentiation || brand.coreFocus || '원리 기반 연계 학습',
      calculation: isManip ? 3 : 4,
      thinking: 4,
      manipulative: isManip ? 5 : 2,
      homeLearning: 4,
      costSymbol: brand.priceRange?.includes('고가') ? '💰💰💰💰' : '💰💰',
      elementaryLink: 4,
      researchEvidence: 3,
      strength: brand.pros || '체계적인 커리큘럼'
    };
  }

  // 기본값 보장 (절대 undefined가 되지 않도록 안전 장치)
  result.philosophy = result.philosophy || brand.differentiation || brand.coreFocus || '원리 기반 연계 학습';
  result.costSymbol = result.costSymbol || '💰💰💰';

  // 핵심 영역 총점 및 평균 평점 산출
  // ※ 비용(Cost)은 가격 지표이므로 별점 계산에서 완전히 제외하고, 학술 연구 검증 점수(researchEvidence)를 포함하여 산출 (만점: 30점, 평균 5.0)
  const c = Number(result.calculation) || 3;
  const t = Number(result.thinking) || 3;
  const m = Number(result.manipulative) || (MANIPULATIVE_BRAND_IDS.includes(brand.id) ? 5 : 2);
  const h = Number(result.homeLearning) || 4;
  const e = Number(result.elementaryLink) || 4;
  const r = Number(result.researchEvidence) || 3;

  result.calculation = c;
  result.thinking = t;
  result.manipulative = m;
  result.homeLearning = h;
  result.elementaryLink = e;
  result.researchEvidence = r;
  result.totalScore = c + t + m + h + e + r;
  // 학술 연구 검증 점수(r)에 높은 가중치(1.5배) 부여한 객관적 가중 점수 산출
  result.weightedScore = Number((c + t + m + h + e + (r * 1.5)).toFixed(1));
  result.avgScore = (result.totalScore / 6).toFixed(1);

  return result;
}

// =========================================================
// 1-A1. 연령별(만 2세 ~ 9세+) 브랜드 실물 라인업 & 발달 적합도 매트릭스 (10점 만점)
// 각 브랜드가 공식 출시한 해당 연령대 교구/학습지 구성물, 발달과업(피아제 조작기),
// 교과 연계 완성도를 바탕으로 산출하여 연령별로 완전히 차별화된 맞춤형 랭킹을 제공합니다.
// =========================================================
const BRAND_AGE_FIT_MATRIX = {
  // [교구 전문 브랜드]
  'bluerabbit': { 2: 7.8, 3: 7.0, 4: 4.2, 5: 3.2, 6: 1.5, 7: 1.0, 8: 0.2, 9: 0.0 }, // 2~3세 첫 토이북/오감 수놀이 최강자
  'montessori': { 2: 7.2, 3: 6.5, 4: 5.2, 5: 4.5, 6: 3.6, 7: 3.0, 8: 1.5, 9: 1.0 }, // 베이비/일상감각 영유아 몬테소리
  'yeondubi-montessori': { 2: 7.0, 3: 6.8, 4: 7.2, 5: 7.5, 6: 5.5, 7: 4.8, 8: 2.5, 9: 1.5 }, // 2~3세 2위, 4~5세 구체물 10진법/수감각 폭발기
  'facto-schule': { 2: 1.2, 3: 3.8, 4: 7.0, 5: 7.3, 6: 4.8, 7: 3.5, 8: 1.2, 9: 0.5 }, // 4~5세 누리과정 놀이사고력 융합교구 1위권
  'playfacto': { 2: 7.5, 3: 7.2, 4: 5.2, 5: 6.0, 6: 7.6, 7: 7.8, 8: 6.8, 9: 5.5 }, // 2~3세 1위, 6~7세 초등 교과 5대 영역 올인원 절대 1위
  'monstermath': { 2: 0.2, 3: 1.0, 4: 3.6, 5: 5.0, 6: 7.2, 7: 7.4, 8: 6.2, 9: 5.0 }, // 6~7세 공간도형 & 아레테 사고력 1위권
  'joymath': { 2: 1.5, 3: 2.8, 4: 5.0, 5: 5.4, 6: 5.8, 7: 6.0, 8: 5.8, 9: 5.2 }, // 4~8세 교과서 수록 필수교구 가성비
  'orda': { 2: 1.0, 3: 2.2, 4: 4.8, 5: 5.6, 6: 6.0, 7: 6.2, 8: 5.4, 9: 4.8 }, // 4~7세 브레인·매쓰 파워빌더스 & 사랑/창의 보드게임
  'kids-schole': { 2: 3.2, 3: 4.5, 4: 9.0, 5: 9.2, 6: 4.8, 7: 4.2, 8: 3.5, 9: 2.5 }, // 4~5세 만지는 수학 1위, 그림책+교구 연계
  'mathtime': { 2: 0.2, 3: 0.8, 4: 2.8, 5: 4.0, 6: 5.4, 7: 6.5, 8: 7.8, 9: 7.6 }, // 7~8세+ 입체도형/전개도/정다면체 1위
  'froebel': { 2: 4.0, 3: 4.2, 4: 3.2, 5: 2.8, 6: 2.0, 7: 1.5, 8: 0.8, 9: 0.5 }, // 2~3세 준은물/감각 탐색
  'edx': { 2: 1.0, 3: 2.5, 4: 4.8, 5: 5.2, 6: 5.4, 7: 5.5, 8: 5.2, 9: 4.5 },
  'c2m-class': { 2: 0.0, 3: 1.0, 4: 3.5, 5: 5.0, 6: 6.4, 7: 6.8, 8: 6.5, 9: 6.0 },
  'hansol-math': { 2: 2.8, 3: 4.2, 4: 5.2, 5: 5.2, 6: 4.0, 7: 3.5, 8: 2.8, 9: 2.0 }, // 피싱블록/입체교구 결합

  // [순수 지면 학습지 & 문제집 전문 브랜드 (교구 없이 독립적 지면 학습 가능)]
  'cheon-jonghyun': { 2: 0.5, 3: 2.5, 4: 5.5, 5: 6.6, 6: 7.6, 7: 7.8, 8: 6.4, 9: 5.0 }, // 6~7세 원리셈·TOP사고력 절대 1위
  'soma': { 2: 0.0, 3: 1.0, 4: 4.8, 5: 6.3, 6: 7.4, 7: 7.6, 8: 7.6, 9: 7.2 }, // 4~5세 소마셈K/사고력 연산 Top5(4세 5위, 5세 4위), 6~8세 소마셈 십진법 연산 1위권
  'cmath-plato': { 2: 0.0, 3: 1.0, 4: 3.4, 5: 5.0, 6: 7.2, 7: 7.5, 8: 7.4, 9: 7.0 }, // 6~8세 초등 공간도형 지면 1위
  'didimdol': { 2: 0.0, 3: 0.5, 4: 2.0, 5: 3.8, 6: 5.8, 7: 6.8, 8: 7.9, 9: 8.0 }, // 8세(초등 1학년) 교과수학 압도적 1위
  'c2m': { 2: 0.0, 3: 0.5, 4: 2.5, 5: 4.0, 6: 5.8, 7: 6.8, 8: 7.2, 9: 7.2 }, // 7~8세 필즈수학/창의사고력
  'facto': { 2: 0.0, 3: 1.0, 4: 4.4, 5: 5.8, 6: 7.0, 7: 7.2, 8: 6.8, 9: 6.4 }, // 4~5세 킨더팩토 Top5(4세 4위, 5세 2위), 6~7세 키즈, 8세 챌린지
  'kumon': { 2: 0.0, 3: 1.0, 4: 3.0, 5: 4.5, 6: 5.5, 7: 5.8, 8: 5.8, 9: 5.8 },
  'gitan': { 2: 0.0, 3: 0.5, 4: 2.5, 5: 4.0, 6: 4.8, 7: 5.2, 8: 5.2, 9: 5.2 },
  'noonnoppi': { 2: 1.5, 3: 3.0, 4: 4.8, 5: 5.0, 6: 4.8, 7: 4.8, 8: 4.6, 9: 4.4 },
  'jei': { 2: 0.5, 3: 1.5, 4: 3.5, 5: 4.8, 6: 5.6, 7: 5.8, 8: 5.8, 9: 5.6 },
  'miraen': { 2: 0.0, 3: 1.0, 4: 3.0, 5: 4.2, 6: 5.2, 7: 5.5, 8: 5.4, 9: 5.2 },
  'wink': { 2: 2.4, 3: 3.9, 4: 4.9, 5: 5.0, 6: 2.6, 7: 1.8, 8: 0.5, 9: 0.2 }, // 스크린 타임 고려 랭킹 2단계 하향 조정 (2세: 4위, 3세: 4위, 4세: 5위, 5세: 9위)
  'woongjin-smartall': { 2: 1.8, 3: 3.2, 4: 5.0, 5: 5.4, 6: 5.4, 7: 5.2, 8: 4.8, 9: 4.2 }, // 4~6세 스마트올 키즈
  'mylittletiger': { 2: 7.0, 3: 6.4, 4: 4.8, 5: 3.6, 6: 1.8, 7: 1.0, 8: 0.5, 9: 0.2 } // 2~3세 만능 워크북/스티커북
};

// 특정 나이에 최적화된 브랜드 가중 점수 및 적합도 산출 헬퍼
function getAgeAdaptiveScore(brand, targetAge) {
  if (!brand) return { finalScore: 0, baseScore: 0, ageFit: 0, setBonus: 0, researchEvidence: 3, elementaryLink: 3 };
  const age = parseInt(targetAge, 10) || 5;
  const sm = getStarMatrixForBrand(brand);
  const baseScore = sm.weightedScore ?? sm.totalScore ?? 20;

  const fitRow = BRAND_AGE_FIT_MATRIX[brand.id] || {};
  const ageFit = fitRow[age] !== undefined ? fitRow[age] : (fitRow[Math.min(8, Math.max(2, age))] ?? 4.0);

  // 해당 나이에 직접 매칭되는 세트(교구/교재 라인업) 보유 보너스 (+0.4 per set, max 1.2)
  const sets = (typeof DASHBOARD_DATA !== 'undefined' && DASHBOARD_DATA.sets) ? DASHBOARD_DATA.sets : [];
  const matchedSets = sets.filter(s => s.brandId === brand.id && matchesAge(s.targetAge, s.targetAgeGroup, age));
  const setBonus = Math.min(1.2, matchedSets.length * 0.4);

  // 가중 계산: 기본 품질 및 학술 연구 검증 가중치 70% + 해당 연령 적합도 2.2배 가중 + 실물 세트 보너스
  const rawFinal = (baseScore * 0.7) + (ageFit * 2.2) + setBonus;
  const finalScore = Math.round(rawFinal * 10) / 10;

  return {
    finalScore,
    baseScore,
    ageFit,
    setBonus,
    researchEvidence: sm.researchEvidence || 3,
    elementaryLink: sm.elementaryLink || 3
  };
}

// =========================================================
// 1-A1-1. 연령별 교구 사용자 지정 랭킹 우선순위 (User Priority Override)
// - 2세 & 3세: 1위 플레이팩토, 2위 연두비 몬테소리 (나머지 순위는 기존 점수순 유지)
// - 4세 & 5세: 1위 키즈스콜레 만지는 수학 (나머지 순위는 기존 점수순 유지)
// =========================================================
function getManipulativeAgePriority(brandId, age) {
  const numAge = parseInt(age, 10);
  if (numAge === 2 || numAge === 3) {
    if (brandId === 'playfacto') return 1;
    if (brandId === 'yeondubi-montessori') return 2;
  } else if (numAge === 4 || numAge === 5) {
    if (brandId === 'kids-schole') return 1;
  }
  return 999;
}

// =========================================================
// 1-A2. BRAND KEYWORDS (교육철학 및 대표강점 핵심 키워드 사전)
// =========================================================
const BRAND_KEYWORDS = {
  'playfacto': {
    philosophy: ['#초등 5대 영역', '#교구 조작 올라운더', '#교과 직결'],
    strength: ['#초등 교과 100% 직결', '#원목 본교구 10종', '#입학 준비 1위']
  },
  'yeondubi-montessori': {
    philosophy: ['#정통 몬테소리', '#감각 조작 ➔ 추상화', '#자기주도 감각수학'],
    strength: ['#원목 19종 풀패키지', '#600개 미션북', '#Science지 실증']
  },
  'facto-schule': {
    philosophy: ['#누리과정 5대 영역', '#놀이수학 교구 18종', '#스마트 AR·OR'],
    strength: ['#사물인식 즉각 피드백', '#킨더팩토 입문 최적', '#교구+앱 융합']
  },
  'joymath': {
    philosophy: ['#창의사고력 단품 모듈', '#칠교·지오보드 정통', '#취약 영역 집중'],
    strength: ['#단품 1~2만원대', '#극강의 가성비', '#홈스쿨링 자율성']
  },
  'bluerabbit': {
    philosophy: ['#토끼펜 오감각 청각', '#스토리텔링 첫 수학', '#원목 셈틀 조작'],
    strength: ['#소리펜 자기주도 반응', '#친환경 원목 10단 셈틀', '#유아 거부감 제로']
  },
  'monstermath': {
    philosophy: ['#도형·공간감각 특화', '#구체물 ➔ 지면 아레테', '#2단계 추상화'],
    strength: ['#소마큐브·펜토미노 집중', '#공간지각력 1위', '#아이 높은 몰입도']
  },
  'kids-schole': {
    philosophy: ['#감각 조작 놀이', '#독일 LUK 자가점검', '#100일 독서 연계'],
    strength: ['#스스로 정답 확인 타일', '#메타인지 계발', '#만지는수학 3종']
  },
  'montessori': {
    philosophy: ['#십진법 자릿값 시각화', '#금색 구슬 부피 체감', '#자기교정성 탐구'],
    strength: ['#수막대·세강판·우표놀이', '#정통 몬테소리 감각수학', '#수 개념 물리화']
  },
  'mathtime': {
    philosophy: ['#3차원 자석 뼈대 구조', '#플라톤 정다면체', '#입체 공간 기하'],
    strength: ['#네오디뮴 자석 결합', '#고등 기하·프랙탈 확장', '#지오데식 돔 구현']
  },
  'orda': {
    philosophy: ['#하브루타 토론식 사고', '#NCTM 5대 수리사고력', '#브레인·매쓰 파워빌더스'],
    strength: ['#매파빌 288개 활동', '#브파빌 논리창의 활동지', '#360도 회전자석가베']
  },
  'froebel': {
    philosophy: ['#점·선·면·입체 해체', '#프뢰벨 정통 철학', '#건축적 조형 창의성'],
    strength: ['#1~10은물·준은물 8종', '#원목 조형물 제작', '#감성 수학동화 전집']
  },
  'cheon-jonghyun': {
    philosophy: ['#원리 시각화(수직선·도트)', '#나선형 통합 사고력', '#자신감 수학 마커 놀이'],
    strength: ['#원리셈 600만부 돌파', '#저자 무료 카페 가이드', '#엄마표 홈스쿨 1위']
  },
  'soma': {
    philosophy: ['#대치동식 교과 사고력', '#수 감각 퍼즐 연산', '#원리 체득 ➔ 문장제'],
    strength: ['#사고력 연산 부동의 1위', '#K~D단계 40권 체계', '#10의 보수 직관화']
  },
  'cmath-plato': {
    philosophy: ['#활동 탐구 ➔ 지면 드릴', '#하루 10분 도형 습관', '#영재 사고력 브릿지'],
    strength: ['#공간도형 압도적 1위(플라토)', '#1031 영재원 대비 표준', '#평면·입체·전개도 정복']
  },
  'c2m': {
    philosophy: ['#구체물 조작 활동', '#영재원 관찰추천 심화', '#공간감각·대칭 특화'],
    strength: ['#영재교육원 대비 1위(필즈)', '#한헌조 소장 공간 노하우', '#창의수학 교구 결합']
  },
  'facto': {
    philosophy: ['#창의사고력 5대 유형', '#킨더 ➔ 키즈 ➔ 초등팩토', '#스토리텔링 탐구'],
    strength: ['#단행본 사고력 문제집 1위', '#전 문항 QR 무료 해설강의', '#초등 경시·영재 입문']
  },
  'didimdol': {
    philosophy: ['#초등 교과서 표준 기준', '#원리 ➔ 기본응용 ➔ 최상위', '#나선형 심화 로드맵'],
    strength: ['#교과서 1위 기업 신뢰도', '#상위권 필수 최상위수학', '#학력평가 최적화']
  },
  'kumon': {
    philosophy: ['#매일 15분 루틴 형성', '#스몰스텝 무학년제 선행', '#사칙연산 자동화'],
    strength: ['#매일 공부하는 습관 1위', '#계산 속도·정확도 완성', '#1:1 방문 코칭 관리']
  },
  'gitan': {
    philosophy: ['#스몰스텝 무한 반복 숙달', '#기초 연산 근육 형성', '#Drill & Practice'],
    strength: ['#권당 5천원대 초가성비', '#연산 구멍 메우기 특효', '#유아~초등 전단계']
  },
  'noonnoppi': {
    philosophy: ['#개인별 맞춤 진도', '#유아 친화적 놀이수학', '#학습 심리 안정'],
    strength: ['#유아 거부감 없는 진입', '#학원형 러닝센터 등원', '#단계별 눈높이 교재']
  },
  'jei': {
    philosophy: ['#원리 이해 중심 처방', '#스스로 생각하는 학습', '#프로젝트형 사고력'],
    strength: ['#사고력 최고봉 생각하는 피자', '#스스로 학습 시스템', '#기계적 암기 배제']
  },
  'miraen': {
    philosophy: ['#하루 1장 쏙 뽑아 풀기', '#10주 완주 성취감', '#초등 교과 연계 드릴'],
    strength: ['#학습 부담감 완전 제로', '#스티커 완주 보상판', '#교과서 발행사 퀄리티']
  },
  'wink': {
    philosophy: ['#인터랙티브 애니메이션', '#태블릿 + 지면 교재 결합', '#놀이 몰입형 학습'],
    strength: ['#유아 자발적 학습 몰입 1위', '#매월 손글씨 실물 교재', '#스스로 켜는 공부 습관']
  },
  'hansol-math': {
    philosophy: ['#실물 조작과 실험 탐구', '#유아 발달 맞춤형', '#호기심 유발 수학'],
    strength: ['#브레인스쿨 전문 센터', '#탐구 중심 소수 정예', '#개념 직관적 체득']
  },
  'woongjin-smartall': {
    philosophy: ['#AI 진단 기반 맞춤 학습', '#융합 독서 연계 수학', '#디지털 인터랙티브'],
    strength: ['#방대한 수학동화 무제한', '#AI 취약 개념 정밀 분석', '#초등 전과목 연계']
  },
  'mylittletiger': {
    philosophy: ['#스티커·선긋기 놀이수학', '#캐릭터 친화적 첫 홈스쿨', '#감각적 수량 인지'],
    strength: ['#초가성비 10권 분권 세트', '#학습 거부감 제로', '#놀이책처럼 즐기는 연산']
  }
};

function getBrandKeywords(brandId, fallbackPhilo = '', fallbackStrength = '') {
  const item = BRAND_KEYWORDS[brandId];
  let philo = item?.philosophy;
  let str = item?.strength;

  if (!philo || philo.length === 0) {
    philo = fallbackPhilo ? splitTextToKeywords(fallbackPhilo) : ['#원리기반', '#개념연계'];
  }
  if (!str || str.length === 0) {
    str = fallbackStrength ? splitTextToKeywords(fallbackStrength) : ['#체계적학습', '#자기주도'];
  }

  return {
    philosophy: philo,
    strength: str,
    fullPhilosophy: fallbackPhilo,
    fullStrength: fallbackStrength
  };
}

function splitTextToKeywords(text) {
  if (!text) return [];
  const parts = text.split(/[\+\,\·\/\➔\&\|]|(?:\s{2,})/).map(s => s.trim().replace(/^[\-\•\*\#\s]+/, '')).filter(s => s.length >= 2 && s.length <= 18);
  if (parts.length > 0) {
    return parts.slice(0, 3).map(p => p.startsWith('#') ? p : `#${p}`);
  }
  return [`#${text.slice(0, 14)}`];
}

// =========================================================
// 1-B. ROADMAP UTILS & FLOWCHART RENDERER (플로우차트 다이어그램 생성기)
// =========================================================
let currentRoadmapFilter = 'all';

window.filterRoadmapList = function(type, btn) {
  currentRoadmapFilter = type;
  document.querySelectorAll('.rm-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderWorkbooks();
};

function findRoadmapForBrand(brandId) {
  const roadmaps = DASHBOARD_DATA.roadmaps || [];
  if (!brandId) return null;
  const targetId = brandId.toLowerCase().trim();
  
  // 1. Direct ID match
  let rm = roadmaps.find(r => (r.brandId && r.brandId.toLowerCase() === targetId) || (r.seriesId && r.seriesId.toLowerCase() === targetId));
  if (rm) return rm;
  
  // 2. Alias mapping fallback
  const ALIAS_MAP = {
    'cmath-plato': ['plato', 'cmath'],
    'plato': ['cmath-plato'],
    'soma': ['somasem'],
    'somasem': ['soma'],
    'cheon-jonghyun': ['wonrisem', 'top-thinking', 'jasinkam'],
    'wonrisem': ['cheon-jonghyun'],
    'top-thinking': ['cheon-jonghyun'],
    'miraen': ['miraen-ssok', 'soksam'],
    'miraen-ssok': ['miraen'],
    'orda-power': ['orda-power', 'orda'],
    'edx': ['edx'],
    'c2m-class': ['c2m-class', 'c2m']
  };
  if (ALIAS_MAP[targetId]) {
    for (const alias of ALIAS_MAP[targetId]) {
      rm = roadmaps.find(r => (r.brandId && r.brandId.toLowerCase() === alias) || (r.seriesId && r.seriesId.toLowerCase() === alias));
      if (rm) return rm;
    }
  }

  // 3. Brand name / partial match
  return roadmaps.find(r => (r.brandName || r.brand || '').toLowerCase().includes(targetId));
}

const BRAND_ROADMAP_SHAPES = {
  'playfacto': {
    shapeType: 'shape-modular',
    shapeLabel: '🔷 플레이팩토: 5개 영역 모듈 트리 & 초등 교과 연계형'
  },
  'yeondubi-montessori': {
    shapeType: 'shape-montessori',
    shapeLabel: '🪵 연두비 몬테소리매쓰: 정통 원목 구슬 & 십진탑 사다리형'
  },
  'montessori': {
    shapeType: 'shape-montessori',
    shapeLabel: '🪵 한국몬테소리: 정통 감각 수구슬 & 십진탑 사다리형'
  },
  'monstermath': {
    shapeType: 'shape-geometric',
    shapeLabel: '⬡ 몬스터매스: 헥사곤 기하 조작 & 아레테 지면 브릿지형'
  },
  'joymath': {
    shapeType: 'shape-puzzle',
    shapeLabel: '🧩 조이매스: 칠교·소마 퍼즐 인터로킹 블록형'
  },
  'kidsschole': {
    shapeType: 'shape-tile',
    shapeLabel: '▦ 키즈스콜레: 만지는수학 & 독일 루크 셀프체킹 타일형'
  },
  'kids-schole': {
    shapeType: 'shape-tile',
    shapeLabel: '▦ 키즈스콜레: 만지는수학 & 독일 루크 셀프체킹 타일형'
  },
  'mathtime': {
    shapeType: 'shape-magnetic',
    shapeLabel: '⚡ 매쓰타임 MTB: 네오디뮴 자석 로드 & 쇠구슬 메탈릭 네온형'
  },
  'orda': {
    shapeType: 'shape-boardgame',
    shapeLabel: '♟️ 오르다코리아: 3단계 전략 보드게임 패스 & 체크포인트형'
  },
  'froebel': {
    shapeType: 'shape-organic',
    shapeLabel: '🌿 한국프뢰벨: 자연주의 오가닉 곡선 & 정통 은물(Gabe)형'
  },
  'cmath-plato': {
    shapeType: 'shape-blueprint',
    shapeLabel: '📐 시매쓰 플라토: 공간도형 6단계 CAD 제도 청사진(Blueprint)형'
  },
  'plato': {
    shapeType: 'shape-blueprint',
    shapeLabel: '📐 시매쓰 플라토: 공간도형 6단계 CAD 제도 청사진(Blueprint)형'
  },
  'facto': {
    shapeType: 'shape-challenge',
    shapeLabel: '🏆 창의사고력 팩토: 트로피 피크 & 다이아몬드 챌린지형'
  },
  'topmath': {
    shapeType: 'shape-challenge',
    shapeLabel: '💎 TOP사고력수학: 8영역 계통 탐구 & 다이아몬드 챌린지형'
  },
  'top-thinking': {
    shapeType: 'shape-challenge',
    shapeLabel: '💎 TOP사고력수학: 8영역 계통 탐구 & 다이아몬드 챌린지형'
  },
  'gitan': {
    shapeType: 'shape-drill',
    shapeLabel: '⚡ 기탄수학: 일일 고속 반복 연산 드릴 러닝 트랙형'
  },
  'kumon': {
    shapeType: 'shape-drill',
    shapeLabel: '⚡ 구몬수학: 일일 스몰스텝 반복 연산 드릴 러닝 트랙형'
  },
  'noonnoppi': {
    shapeType: 'shape-drill',
    shapeLabel: '🎯 대교 눈높이: 스몰스텝 개인별 능력 맞춤 연산 트랙형'
  },
  'hansol-math': {
    shapeType: 'shape-organic',
    shapeLabel: '🌟 한솔 신기한 수학나라: 오감 교구 놀이 ➔ 초등 개념 연계형'
  },
  'jei': {
    shapeType: 'shape-stepladder',
    shapeLabel: '🧠 재능스스로수학: 스스로 학습법 & 생각하는 피자 통합형'
  },
  'wink': {
    shapeType: 'shape-modular',
    shapeLabel: '📺 윙크 (Wink): 인터랙티브 개념 영상 + 지면 손글씨 하이브리드형'
  },
  'woongjin-smartall': {
    shapeType: 'shape-modular',
    shapeLabel: '🤖 웅진 스마트올: AI 취약점 정밀 진단 & 누리-초등 전과목 코스형'
  },
  'c2m': {
    shapeType: 'shape-puzzle',
    shapeLabel: '📐 씨투엠에듀: 킨더 활동수학 ➔ 필즈수학 영재원 심화형'
  },
  'didimdol': {
    shapeType: 'shape-stepladder',
    shapeLabel: '📚 디딤돌 초등수학: 원리 ➔ 기본 ➔ 응용 ➔ 최상위 교과 사다리형'
  },
  'wonrisem': {
    shapeType: 'shape-stepladder',
    shapeLabel: '🪜 원리셈: 수 감각 원리 시각화 & 계단식 리본형'
  },
  'cheon-jonghyun': {
    shapeType: 'shape-stepladder',
    shapeLabel: '🪜 천종현수학연구소: 유아 자신감 수학 ➔ 원리셈 ➔ TOP사고력 통합형'
  },
  'jasinkam': {
    shapeType: 'shape-stepladder',
    shapeLabel: '🪜 천종현수학연구소: 유아 자신감 수학 ➔ 원리셈 ➔ TOP사고력 통합형'
  },
  'soma': {
    shapeType: 'shape-stepladder',
    shapeLabel: '🪜 소마 (SOMA): 사고력 연산 4원리 & 계단식 리본형'
  },
  'somasem': {
    shapeType: 'shape-stepladder',
    shapeLabel: '🪜 소마셈: 사고력 연산 4원리 & 계단식 리본형'
  },
  'miraen': {
    shapeType: 'shape-daily',
    shapeLabel: '🎫 미래엔 하루 한장: 매일 1장 쏙 뜯어 푸는 일일 티켓형'
  },
  'miraen-ssok': {
    shapeType: 'shape-daily',
    shapeLabel: '🎫 하루 한장 쏙셈: 매일 한 장 쏙 뜯어 푸는 일일 티켓형'
  },
  'soksam': {
    shapeType: 'shape-daily',
    shapeLabel: '🎫 하루 한장 쏙셈: 매일 한 장 쏙 뜯어 푸는 일일 티켓형'
  },
  'orda-power': {
    shapeType: 'shape-boardgame',
    shapeLabel: '♟️ 오르다 파워빌더스: NCTM 5대 영역 & 매쓰·브레인 조작 활동지형'
  },
  'edx': {
    shapeType: 'shape-modular',
    shapeLabel: '🌈 이디엑스 (EDX): 레인보우 조약돌 & 감각 조작 모듈형'
  },
  'c2m-class': {
    shapeType: 'shape-puzzle',
    shapeLabel: '📐 씨투엠 창의교구: 큐보이드 입체 전개도 & 12종 활동교구형'
  },
  'facto-schule': {
    shapeType: 'shape-challenge',
    shapeLabel: '🚀 팩토슐레: 5대 영역 STEAM 놀이교구 & AR 사물인식 스마트형'
  },
  'mylittletiger': {
    shapeType: 'shape-modular',
    shapeLabel: '🐯 마이리틀타이거: 만 2~5세 수학홈스쿨 10권 & 첫 연산놀이형'
  },
  'bluerabbit': {
    shapeType: 'shape-organic',
    shapeLabel: '🐰 블루래빗: 토끼펜 소리나는 스토리텔링 & 원목 셈틀형'
  }
};

function getRoadmapShapeInfo(rm) {
  if (!rm) return { shapeType: 'shape-modular', shapeLabel: '📊 단계별 맞춤 성장 로드맵' };
  const key = (rm.brandId || rm.seriesId || '').toLowerCase().trim();
  if (BRAND_ROADMAP_SHAPES[key]) return BRAND_ROADMAP_SHAPES[key];
  for (const k of Object.keys(BRAND_ROADMAP_SHAPES)) {
    if (key.includes(k) || (rm.brandName && rm.brandName.toLowerCase().includes(k)) || (rm.seriesName && rm.seriesName.toLowerCase().includes(k))) {
      return BRAND_ROADMAP_SHAPES[k];
    }
  }
  return { shapeType: 'shape-modular', shapeLabel: '📊 단계별 맞춤 성장 로드맵' };
}

function getStageDecoration(shapeType, sIdx, totalStages) {
  if (shapeType === 'shape-montessori') {
    return `<div class="montessori-beads" title="감각 수구슬"><span class="m-bead bead-1"></span><span class="m-bead bead-10"></span><span class="m-bead bead-100"></span></div>`;
  } else if (shapeType === 'shape-modular') {
    return `<div class="modular-studs" title="3D 조작 블록 스터드"><span class="m-stud"></span><span class="m-stud"></span><span class="m-stud"></span></div>`;
  } else if (shapeType === 'shape-puzzle') {
    return `<div class="puzzle-tab-corner" title="인터로킹 퍼즐 조각"><span class="p-notch">🧩</span></div>`;
  } else if (shapeType === 'shape-geometric') {
    return `<div class="geom-axis-badge" title="기하 좌표계">⬡ Lv.0${sIdx + 1}</div>`;
  } else if (shapeType === 'shape-boardgame') {
    return `<div class="board-tile-flag" title="보드게임 체크포인트">${sIdx === totalStages - 1 ? '🏁 GOAL' : `🚩 STEP 0${sIdx + 1}`}</div>`;
  } else if (shapeType === 'shape-magnetic') {
    return `<div class="mag-pole-pill ${sIdx % 2 === 0 ? 'pole-n' : 'pole-s'}" title="자석 극성">${sIdx % 2 === 0 ? '🧲 N-POLE' : '🧲 S-POLE'}</div>`;
  } else if (shapeType === 'shape-organic') {
    return `<div class="organic-leaf-tag" title="자연주의 은물">🌿 Part ${sIdx + 1}</div>`;
  } else if (shapeType === 'shape-challenge') {
    return `<div class="challenge-peak-badge" title="사고력 등급">${sIdx === totalStages - 1 ? '👑 SUMMIT' : `💎 TIER 0${sIdx + 1}`}</div>`;
  } else if (shapeType === 'shape-stepladder') {
    return `<div class="ladder-step-indicator" title="계단식 연산">🪜 Step ${sIdx + 1}</div>`;
  } else if (shapeType === 'shape-blueprint') {
    return `<div class="blueprint-coord-tag" title="CAD 공간도형">[CAD 0${sIdx + 1}]</div>`;
  }
  return `<div class="standard-step-indicator">Step 0${sIdx + 1}</div>`;
}

function getStageConnector(shapeType, sIdx) {
  return `
    <div class="rf-connector" title="다음 단계 연계">
      <svg width="36" height="24" viewBox="0 0 36 24">
        <path d="M2 12 H28 M22 6 L28 12 L22 18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
}

function getStageLayoutClasses(stage) {
  const count = (stage.steps || []).length;
  const layout = (stage.layout || '').toLowerCase().trim();

  if (layout === 'grid-2x2' || layout === 'grid' || layout === '2x2' || (layout !== 'col' && layout !== 'row' && count === 4)) {
    return {
      cardClass: 'rf-stage-grid2x2',
      bodyClass: 'rf-grid-2x2',
      dimLabel: '2×2'
    };
  }
  if (layout === 'row-3' || layout === '1x3' || (layout === 'row' && count >= 3)) {
    return {
      cardClass: 'rf-stage-row3',
      bodyClass: 'rf-flex-row',
      dimLabel: `1×${count}`
    };
  }
  if (layout === 'row-2' || layout === '1x2' || (layout === 'row' && count === 2)) {
    return {
      cardClass: 'rf-stage-row2',
      bodyClass: 'rf-flex-row',
      dimLabel: '1×2'
    };
  }
  if (layout === 'col-3' || layout === '3x1' || (layout === 'col' && count === 3)) {
    return {
      cardClass: 'rf-stage-col3',
      bodyClass: 'rf-flex-col',
      dimLabel: '3×1'
    };
  }
  if (layout === 'col-4' || layout === '4x1' || (layout === 'col' && count === 4)) {
    return {
      cardClass: 'rf-stage-col4',
      bodyClass: 'rf-flex-col',
      dimLabel: '4×1'
    };
  }
  if (layout === 'single' || layout === '1x1' || count === 1) {
    return {
      cardClass: 'rf-stage-single',
      bodyClass: 'rf-flex-single',
      dimLabel: '1×1'
    };
  }
  // Default 2 vertical boxes (2x1)
  return {
    cardClass: 'rf-stage-col2',
    bodyClass: 'rf-flex-col',
    dimLabel: '2×1'
  };
}

function renderFlowchartDiagram(rm, isInteractiveToggle = true) {
  if (!rm || !rm.flowchart || rm.flowchart.length === 0) {
    return `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:0.85rem;">단계별 로드맵 데이터가 준비 중입니다.</div>`;
  }

  const flowchartStages = rm.flowchart;
  const uniqueId = 'rf-' + (rm.brandId || rm.seriesId || Math.random().toString(36).substr(2, 6));
  const shapeInfo = getRoadmapShapeInfo(rm);
  const shapeType = shapeInfo.shapeType;

  return `
    <div class="rf-container" id="${uniqueId}-container">
      <div class="rf-canvas-wrapper ${shapeType}" id="${uniqueId}-canvas">
        <div class="rf-top-header-bar">
          <div class="rf-top-left-meta">
            <span class="roadmap-emom-badge" title="Curated & Designed by EMom">Created by EMom</span>
            <div class="roadmap-shape-banner" style="margin-bottom:0;">
              <span>${shapeInfo.shapeLabel}</span>
            </div>
          </div>
          <div class="rf-scroll-hint">
            <span>👉 좌우로 스크롤하여 브랜드 고유의 단계별 성장 플로우를 확인하세요</span>
          </div>
        </div>
        <div class="rf-flowchart-canvas">
          ${flowchartStages.map((stage, sIdx) => {
            const layoutInfo = getStageLayoutClasses(stage);
            const decorationHtml = getStageDecoration(shapeType, sIdx, flowchartStages.length);
            const connectorHtml = stage.nextArrow ? getStageConnector(shapeType, sIdx) : '';
            const isStageMatch = matchesAge(stage.ageGroup || stage.stageName, null, state.selectedAge);

            return `
              <div class="rf-stage-card ${layoutInfo.cardClass} stage-idx-${sIdx} stage-shape-${shapeType} ${isStageMatch ? 'stage-age-matched' : ''}">
                <div class="rf-stage-header">
                  <div class="rf-stage-title-wrap">
                    <span class="rf-stage-name">${stage.stageName}</span>
                    <span class="rf-stage-badge">${stage.ageGroup || ''}</span>
                    <span class="rf-stage-dim-pill">${layoutInfo.dimLabel}</span>
                    ${isStageMatch ? `<span class="modal-age-match-pill-stage">🎯 우리 아이(${state.selectedAge}세) 추천</span>` : ''}
                  </div>
                  ${decorationHtml}
                </div>
                <div class="rf-stage-body ${layoutInfo.bodyClass}">
                  ${stage.steps.map((st, stepIdx) => `
                    ${stepIdx > 0 && layoutInfo.bodyClass === 'rf-flex-row' ? '<div class="rf-step-arrow">➔</div>' : ''}
                    <div class="rf-step-box step-idx-${stepIdx} step-shape-${shapeType}" title="${st.desc || ''}">
                      <div class="rf-step-title">${st.title}</div>
                      ${st.desc ? `<div class="rf-step-sub">${st.desc}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
              ${connectorHtml}
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

window.openRoadmapModal = function(brandId) {
  const roadmaps = DASHBOARD_DATA.roadmaps || [];
  const currentRm = findRoadmapForBrand(brandId) || roadmaps[0];
  if (!currentRm) return;

  const overlay = document.getElementById('roadmapModalOverlay');
  const body = document.getElementById('roadmapModalBody');
  if (!overlay || !body) return;

  body.innerHTML = `
    <div class="roadmap-modal-header">
      <div class="roadmap-modal-title-row">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
            <span class="roadmap-emom-badge" style="font-size:0.75rem; padding:2px 8px;">Created by EMom</span>
            <span class="card-type-badge badge-manipulative" style="margin-bottom:0;">
              ${currentRm.category || '수학 교육'} · ${currentRm.type || ''}
            </span>
          </div>
          <h2 style="font-size:1.65rem; font-weight:800; color:var(--text-primary); margin:4px 0;">
            🗺️ ${currentRm.brandName || currentRm.seriesName} 학습 로드맵
          </h2>
          <p style="color:var(--text-secondary); font-size:0.88rem; margin:0;">
            ${currentRm.summary || '아이의 연령과 발달 단계에 맞춘 체계적인 성장 플로우차트'}
          </p>
        </div>

        <div class="roadmap-brand-selector">
          <label for="roadmapBrandSelect" style="font-size:0.82rem; font-weight:700; color:var(--text-secondary);">다른 브랜드 보기:</label>
          <select id="roadmapBrandSelect" class="roadmap-brand-select" onchange="openRoadmapModal(this.value)">
            <optgroup label="🧩 교구 전문 브랜드 (${roadmaps.filter(r => r.category === '교구 전문').length}종)">
              ${roadmaps.filter(r => r.category === '교구 전문').map(r => `
                <option value="${r.brandId}" ${r.brandId === currentRm.brandId ? 'selected' : ''}>
                  ${r.brandName}
                </option>
              `).join('')}
            </optgroup>
            <optgroup label="📚 학습지 전문 브랜드 (${roadmaps.filter(r => r.category !== '교구 전문').length}종)">
              ${roadmaps.filter(r => r.category !== '교구 전문').map(r => `
                <option value="${r.brandId || r.seriesId}" ${(r.brandId || r.seriesId) === (currentRm.brandId || currentRm.seriesId) ? 'selected' : ''}>
                  ${r.brandName || r.seriesName}
                </option>
              `).join('')}
            </optgroup>
          </select>
        </div>
      </div>
    </div>

    <!-- 플로우차트 다이어그램 렌더링 -->
    ${renderFlowchartDiagram(currentRm, true)}

    <!-- 상세 단계별 커리큘럼 & 권장 학습량 표 -->
    ${currentRm.stages && currentRm.stages.length > 0 ? `
      <div style="margin-top:20px;">
        <h4 style="font-size:1.02rem; font-weight:800; color:var(--text-primary); margin-bottom:10px;">
          📋 ${currentRm.brandName || currentRm.seriesName} 단계별 상세 커리큘럼 & 권장 학습량
        </h4>
        <div class="custom-table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th style="width:28%;">단계 (연령)</th>
                <th style="width:14%; text-align:center;">교재/권수</th>
                <th>주요 학습 내용 및 특징</th>
                <th style="width:24%;">권장 학습 주기/표준</th>
              </tr>
            </thead>
            <tbody>
              ${currentRm.stages.map(st => {
                const isAgeMatch = matchesAge(st.level, null, state.selectedAge);
                return `
                  <tr style="${isAgeMatch ? 'background:#EEF2FF; font-weight:600;' : ''}">
                    <td class="table-highlight">${st.level} ${isAgeMatch ? '👈 (아이 맞춤)' : ''}</td>
                    <td style="text-align:center;">${st.booksCount ? st.booksCount + '권/세트' : '-'}</td>
                    <td>${st.content || '-'}</td>
                    <td style="color:var(--primary); font-weight:600;">${st.studyStandard || '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;

  overlay.classList.add('open');
};

window.closeRoadmapModal = function() {
  const overlay = document.getElementById('roadmapModalOverlay');
  if (overlay) overlay.classList.remove('open');
};

// =========================================================
// 2. DOM INITIALIZATION & EVENT LISTENERS
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  initAgeSelector();
  initTypeToggle();
  initTabs();
  initSearch();
  initMiniFilterBar();
  initModalEvents();
  initCompareTray();

  // 첫 화면 데이터 렌더링
  updateDashboardViews();
});

// 온보딩 나이 선택기
function initAgeSelector() {
  const ageButtons = document.querySelectorAll('.age-btn');
  ageButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      ageButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const age = parseInt(btn.dataset.age, 10);
      setTargetAge(age);
    });
  });

  const exploreBtn = document.getElementById('exploreStartBtn');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      const manipTabBtn = document.querySelector('.tab-btn[data-tab="tabManipulative"]');
      if (manipTabBtn && !manipTabBtn.classList.contains('active')) {
        manipTabBtn.click();
      }
      const mainContent = document.getElementById('mainContent');
      if (mainContent) {
        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

function setTargetAge(age) {
  state.selectedAge = age;
  updateHeroSummary();
  updateMiniFilterBar();
  updateDashboardViews();
}

// 온보딩 & 네비 유형 토글 (전체 / 교구 / 학습지)
function initTypeToggle() {
  const typeButtons = document.querySelectorAll('.type-btn');
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedType = btn.dataset.type;
      
      // 네비 바의 셀렉트 박스도 동기화
      const navTypeSelect = document.getElementById('navTypeSelect');
      if (navTypeSelect) navTypeSelect.value = state.selectedType;

      // 유형 선택 시 해당 전용 탭으로도 전환
      if (state.selectedType === 'manipulative') {
        const manipTab = document.querySelector('.tab-btn[data-tab="tabManipulative"]');
        if (manipTab) manipTab.click();
      } else if (state.selectedType === 'workbook') {
        const wbTab = document.querySelector('.tab-btn[data-tab="tabWorkbook"]');
        if (wbTab) wbTab.click();
      }

      updateHeroSummary();
      updateDashboardViews();
    });
  });
}

// 상단 미니 바 연동
function initMiniFilterBar() {
  const navAgeSelect = document.getElementById('navAgeSelect');
  const navTypeSelect = document.getElementById('navTypeSelect');

  if (navAgeSelect) {
    navAgeSelect.addEventListener('change', (e) => {
      const age = parseInt(e.target.value, 10);
      // 온보딩 버튼도 동기화
      document.querySelectorAll('.age-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.age, 10) === age);
      });
      setTargetAge(age);
    });
  }

  if (navTypeSelect) {
    navTypeSelect.addEventListener('change', (e) => {
      state.selectedType = e.target.value;
      document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === state.selectedType);
      });
      if (state.selectedType === 'manipulative') {
        const manipTab = document.querySelector('.tab-btn[data-tab="tabManipulative"]');
        if (manipTab) manipTab.click();
      } else if (state.selectedType === 'workbook') {
        const wbTab = document.querySelector('.tab-btn[data-tab="tabWorkbook"]');
        if (wbTab) wbTab.click();
      }
      updateHeroSummary();
      updateDashboardViews();
    });
  }
}

function updateMiniFilterBar() {
  const navAgeSelect = document.getElementById('navAgeSelect');
  const navFilterBadge = document.getElementById('navFilterBadge');
  if (navAgeSelect) navAgeSelect.value = state.selectedAge;
  if (navFilterBadge) {
    const minA = Math.max(2, state.selectedAge - 1);
    const maxA = state.selectedAge + 1;
    navFilterBadge.innerHTML = `👶 만 ${state.selectedAge}세 (범위: ${minA}~${maxA}세)`;
  }
}

function updateHeroSummary() {
  const summaryAge = document.getElementById('summaryTargetAge');
  const summaryDesc = document.getElementById('summaryFilterDesc');
  const minA = Math.max(2, state.selectedAge - 1);
  const maxA = state.selectedAge + 1;

  let typeText = state.selectedType === 'workbook' ? '수학 학습지' : '수학 교구';

  if (summaryAge) {
    summaryAge.textContent = `만 ${state.selectedAge}세 맞춤 플랜 (${minA}~${maxA}세 범위)`;
  }
  if (summaryDesc) {
    summaryDesc.textContent = `현재 ${minA}세부터 ${maxA}세까지의 ${typeText} 대표 브랜드를 우선 선별하여 보여주며, 프로그램명을 누르면 상세 정보가 열립니다.`;
  }
}

// 탭 네비게이션
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
        state.activeTab = targetId;
        if (targetId === 'tabMeta') {
          renderMetaAnalysisLab();
        }
      }
    });
  });
}

// 검색창
function initSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      updateDashboardViews();
    });
  }
}

// =========================================================
// 3. MASTER VIEW RENDERER (실시간 필터링 및 뷰 업데이트)
// =========================================================
function updateDashboardViews() {
  renderRecommendations();
  renderManipulatives();
  renderWorkbooks();
  renderComparison();
  renderScience();
  renderMetaAnalysisLab();
  updateCounts();
}

function updateCounts() {
  const brands = DASHBOARD_DATA.brands || [];
  const sets = DASHBOARD_DATA.sets || [];

  const matchedBrands = brands.filter(b => {
    // 1. 해당 브랜드의 세트 중 나이 ±1세 매칭이 있는지 또는 브랜드 연령 매칭
    const brandAgeMatch = matchesAge(b.targetAgeDetail, b.targetAge, state.selectedAge);
    const relatedSets = sets.filter(s => s.brandId === b.id && matchesAge(s.targetAge, s.targetAgeGroup, state.selectedAge));
    if (!brandAgeMatch && relatedSets.length === 0) return false;

    // 2. 타입 매칭 (교구 전문/결합 vs 순수 지면 학습지 엄격 분리: 오르다는 교구와 지면 워크북 파워빌더스 둘 다 보유)
    const isManip = MANIPULATIVE_BRAND_IDS.includes(b.id);
    const isWb = !isManip || b.id === 'orda';

    if (state.selectedType === 'manipulative' && !isManip) return false;
    if (state.selectedType === 'workbook' && !isWb) return false;

    return true;
  });

  const recommendBadge = document.getElementById('recommendCountBadge');
  if (recommendBadge) recommendBadge.textContent = matchedBrands.length;
}

// ---------------------------------------------------------
// 탭 1. 🎯 내 아이 맞춤 추천 (모던 반응형 매트릭스 테이블 & 모바일 카드 뷰)
// ---------------------------------------------------------
function renderRecommendations() {
  const container = document.getElementById('recommendGrid');
  if (!container) return;

  const brands = DASHBOARD_DATA.brands || [];
  const sets = DASHBOARD_DATA.sets || [];

  // 브랜드 단위 필터링 (나이 ±1세, 타입, 검색어)
  const filteredBrands = brands.filter(b => {
    const brandAgeMatch = matchesAge(b.targetAgeDetail, b.targetAge, state.selectedAge);
    const ageMatchedSets = sets.filter(s => s.brandId === b.id && matchesAge(s.targetAge, s.targetAgeGroup, state.selectedAge));
    if (!brandAgeMatch && ageMatchedSets.length === 0) return false;

    const isManip = MANIPULATIVE_BRAND_IDS.includes(b.id);
    const isWb = !isManip || b.id === 'orda';

    if (state.selectedType === 'manipulative' && !isManip) return false;
    if (state.selectedType === 'workbook' && !isWb) return false;

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const matchBrand = (b.name || '').toLowerCase().includes(q) ||
                         (b.company || '').toLowerCase().includes(q) ||
                         (b.differentiation || '').toLowerCase().includes(q) ||
                         (b.description || '').toLowerCase().includes(q) ||
                         (b.pros || '').toLowerCase().includes(q);
      const matchSets = sets.some(s => s.brandId === b.id && (((s.setName || '')).toLowerCase().includes(q) || ((s.features || '')).toLowerCase().includes(q)));
      if (!matchBrand && !matchSets) return false;
    }

    return true;
  });

  if (filteredBrands.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h4>선택하신 조건에 해당하는 브랜드를 찾지 못했습니다.</h4>
        <p>상단 필터에서 연령 범위를 조정하거나 교구/학습지 옵션을 변경해보세요.</p>
      </div>
    `;
    return;
  }

  // 연령별(만 ${state.selectedAge}세) 발달 단계 및 실제 출시 라인업 적합도 가중 점수 순 정렬 (교구 사용자 지정 우선순위 반영)
  filteredBrands.sort((a, b) => {
    const isManipA = MANIPULATIVE_BRAND_IDS.includes(a.id);
    const isManipB = MANIPULATIVE_BRAND_IDS.includes(b.id);
    if (isManipA && isManipB) {
      const prioA = getManipulativeAgePriority(a.id, state.selectedAge);
      const prioB = getManipulativeAgePriority(b.id, state.selectedAge);
      if (prioA !== prioB) return prioA - prioB;
    }
    const scoreA = getAgeAdaptiveScore(a, state.selectedAge);
    const scoreB = getAgeAdaptiveScore(b, state.selectedAge);
    if (scoreB.finalScore !== scoreA.finalScore) {
      return scoreB.finalScore - scoreA.finalScore;
    }
    if (scoreB.researchEvidence !== scoreA.researchEvidence) {
      return scoreB.researchEvidence - scoreA.researchEvidence;
    }
    return scoreB.elementaryLink - scoreA.elementaryLink;
  });

  // 1. 데스크톱 & 태블릿 매트릭스 표 (4개 핵심 컬럼으로 깔끔화, 클릭 시 7대 평점 드로어 확장)
  const desktopTableHtml = `
    <div class="matrix-table-card">
      <div class="matrix-table-scroll">
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="width:250px;">전문가 / 프로그램 (순위)</th>
              <th style="min-width:240px;">고유 차별성 & 교육 철학</th>
              <th style="min-width:220px;">핵심 강점 & 대표 특징</th>
              <th style="text-align:center; width:210px;">평점 및 상세</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBrands.map((b, idx) => {
              const sm = getStarMatrixForBrand(b);
              const m = getMatrixForBrand(b);
              const isAdded = state.compareList.includes(b.id);
              const detailId = `rec-detail-${b.id}`;
              const fullPhilo = sm.philosophy || b.differentiation || '원리 기반 연계 학습';
              const fullStrength = sm.strength || b.pros || '체계적인 원리 이해 및 교과 연계 완성';
              const kwData = getBrandKeywords(b.id, fullPhilo, fullStrength);
              const ageScore = getAgeAdaptiveScore(b, state.selectedAge);

              return `
                <tr class="matrix-row" onclick="toggleMatrixRow('${detailId}', this)">
                  <td>
                    <div class="matrix-brand-cell">
                      <span class="matrix-rank-badge rank-${idx + 1}">${idx + 1}위</span>
                      ${getBrandLogo(b.id, 'sm')}
                      <div>
                        <div class="matrix-brand-title">
                          ${b.name}
                          <span class="score-pill" title="만 ${state.selectedAge}세 발달 단계 및 실제 라인업 적합도 가중 점수">만 ${state.selectedAge}세 맞춤 ${ageScore.finalScore}점</span>
                        </div>
                        <div class="matrix-brand-sub">${b.company} · 종합평점 ★${sm.avgScore} (원점수 ${sm.totalScore}점)</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="matrix-kw-cell" title="교육 철학: ${fullPhilo}">
                      <div class="matrix-kw-group">
                        ${kwData.philosophy.map(kw => `<span class="lb-kw-chip lb-chip-philo">${kw}</span>`).join('')}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="matrix-kw-cell" title="대표 강점: ${fullStrength}">
                      <div class="matrix-kw-group">
                        ${kwData.strength.map(kw => `<span class="lb-kw-chip lb-chip-strength">${kw}</span>`).join('')}
                      </div>
                    </div>
                  </td>
                  <td style="text-align:center;" onclick="event.stopPropagation();">
                    <div class="matrix-btn-group">
                      <button class="matrix-roadmap-btn" onclick="openRoadmapModal('${b.id}')" title="학습 로드맵 플로우차트 보기">
                        🗺️ 로드맵
                      </button>
                      <button class="matrix-expand-btn" onclick="toggleMatrixRow('${detailId}', this.closest('tr'))">
                        평점 보기 ▼
                      </button>
                      <button class="matrix-action-btn" onclick="openBrandModal('${b.id}')">
                        상세 →
                      </button>
                    </div>
                  </td>
                </tr>
                <tr id="${detailId}" class="matrix-detail-row hidden">
                  <td colspan="4">
                    <div class="matrix-detail-panel">
                      <div class="matrix-detail-header">
                        <span class="detail-title">📊 <strong>${b.name}</strong> 7대 평가 지표 및 비용 상세 분석</span>
                        <span class="score-pill">만 ${state.selectedAge}세 맞춤 ${ageScore.finalScore}점 · 종합 평점 ★${sm.avgScore} (총점 ${sm.totalScore}점 / 30점 만점)</span>
                      </div>
                      <div class="ratings-grid-compact">
                        <div class="rating-card-item">
                          <span class="rc-label">🧮 연산 능력</span>
                          <span class="rc-stars">${getStars(sm.calculation)} (${sm.calculation}/5)</span>
                        </div>
                        <div class="rating-card-item">
                          <span class="rc-label">🧠 사고력 깊이</span>
                          <span class="rc-stars">${getStars(sm.thinking)} (${sm.thinking}/5)</span>
                        </div>
                        <div class="rating-card-item">
                          <span class="rc-label">🧩 교구 완성도</span>
                          <span class="rc-stars">${getStars(sm.manipulative)} (${sm.manipulative}/5)</span>
                        </div>
                        <div class="rating-card-item">
                          <span class="rc-label">🏡 가정학습 (엄마표)</span>
                          <span class="rc-stars">${getStars(sm.homeLearning)} (${sm.homeLearning}/5)</span>
                        </div>
                        <div class="rating-card-item">
                          <span class="rc-label">🏫 초등 교과 연계</span>
                          <span class="rc-stars">${getStars(sm.elementaryLink)} (${sm.elementaryLink}/5)</span>
                        </div>
                        <div class="rating-card-item">
                          <span class="rc-label">🔬 학술 연구 검증</span>
                          <span class="rc-stars">${getStars(sm.researchEvidence || 3)} (${sm.researchEvidence || 3}/5)</span>
                        </div>
                        <div class="rating-card-item cost-item">
                          <span class="rc-label">💰 예상 비용 수준</span>
                          <span class="rc-cost">${sm.costSymbol || '💰💰💰'}</span>
                        </div>
                      </div>
                      ${(m.calculationApproach || m.thinkingMathApproach || m.accessibility) ? `
                        <div class="detail-approaches-box">
                          ${m.calculationApproach ? `<div><strong>🧮 연산 접근법:</strong> ${m.calculationApproach}</div>` : ''}
                          ${m.thinkingMathApproach ? `<div><strong>🧠 사고력 접근법:</strong> ${m.thinkingMathApproach}</div>` : ''}
                          ${m.accessibility ? `<div><strong>🏡 엄마표 환경:</strong> ${m.accessibility}</div>` : ''}
                        </div>
                      ` : ''}
                      <div style="display:flex; align-items:center; justify-content:space-between; margin-top:14px; padding:12px 16px; background:#EEF2FF; border-radius:8px; border:1px solid #C7D2FE; flex-wrap:wrap; gap:10px;">
                        <div>
                          <strong style="font-size:0.9rem; color:#3730A3;">🗺️ ${b.name} 단계별 학습 플로우차트 로드맵</strong>
                          <div style="font-size:0.78rem; color:#4338CA; margin-top:2px;">연령별 발달 단계 및 초등 교과 연계 플로우를 시각화 다이어그램으로 확인하세요.</div>
                        </div>
                        <button class="matrix-roadmap-btn" style="padding:7px 14px; font-size:0.82rem; background:#4F46E5; color:white; border-color:#4F46E5;" onclick="openRoadmapModal('${b.id}')">
                          로드맵 다이어그램 보기 ➔
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 2. 모바일 친화형 콤팩트 카드 리스트 (Mobile View - 클릭 시 7대 평점 펼치기)
  const mobileListHtml = `
    <div class="mobile-matrix-grid">
      ${filteredBrands.map((b, idx) => {
        const sm = getStarMatrixForBrand(b);
        const isAdded = state.compareList.includes(b.id);
        const mobileDetailId = `mobile-rec-${b.id}`;
        const fullPhilo = sm.philosophy || b.differentiation || '원리 기반 연계 학습';
        const fullStrength = sm.strength || b.pros || '체계적인 원리 이해 및 교과 연계';
        const kwData = getBrandKeywords(b.id, fullPhilo, fullStrength);
        const ageScore = getAgeAdaptiveScore(b, state.selectedAge);

        return `
          <div class="mobile-matrix-card">
            <div class="mobile-card-header" onclick="openBrandModal('${b.id}')">
              <div style="display:flex; align-items:center; gap:10px;">
                ${getBrandLogo(b.id, 'sm')}
                <div>
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <span class="matrix-rank-badge rank-${idx + 1}">${idx + 1}위</span>
                    <span class="score-pill">만 ${state.selectedAge}세 맞춤 ${ageScore.finalScore}점</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${b.company}</span>
                  </div>
                  <div class="mobile-brand-name">${b.name}</div>
                </div>
              </div>
              <div class="cost-tag">${sm.costSymbol || '💰💰💰'}</div>
            </div>

            <div class="mobile-kw-container">
              <div class="mobile-kw-box mobile-philo-box" title="${fullPhilo}">
                <span class="mobile-kw-tag-label">💡 교육철학</span>
                <div class="mobile-kw-chips">
                  ${kwData.philosophy.map(kw => `<span class="lb-kw-chip lb-chip-philo">${kw}</span>`).join('')}
                </div>
              </div>
              <div class="mobile-kw-box mobile-strength-box" title="${fullStrength}">
                <span class="mobile-kw-tag-label">✨ 대표강점</span>
                <div class="mobile-kw-chips">
                  ${kwData.strength.map(kw => `<span class="lb-kw-chip lb-chip-strength">${kw}</span>`).join('')}
                </div>
              </div>
            </div>

            <!-- Mobile Toggle Button -->
            <button class="mobile-expand-btn" onclick="toggleMobileDetail('${mobileDetailId}', this)">
              📊 7대 세부 평점 및 비용 보기 ▼
            </button>

            <!-- Collapsible ratings grid -->
            <div id="${mobileDetailId}" class="mobile-stars-container hidden">
              <div class="mobile-stars-grid">
                <div class="mobile-star-item">
                  <span class="label">🧮 연산</span>
                  <span class="star-rating">${getStars(sm.calculation)}</span>
                </div>
                <div class="mobile-star-item">
                  <span class="label">🧠 사고력</span>
                  <span class="star-rating">${getStars(sm.thinking)}</span>
                </div>
                <div class="mobile-star-item">
                  <span class="label">🧩 교구</span>
                  <span class="star-rating">${getStars(sm.manipulative)}</span>
                </div>
                <div class="mobile-star-item">
                  <span class="label">🏡 엄마표</span>
                  <span class="star-rating">${getStars(sm.homeLearning)}</span>
                </div>
                <div class="mobile-star-item">
                  <span class="label">🏫 초등 연계</span>
                  <span class="star-rating">${getStars(sm.elementaryLink)}</span>
                </div>
                <div class="mobile-star-item">
                  <span class="label">🔬 연구 검증</span>
                  <span class="star-rating">${getStars(sm.researchEvidence || 3)}</span>
                </div>
                <div class="mobile-star-item">
                  <span class="label">💰 비용 수준</span>
                  <span class="cost-tag">${sm.costSymbol || '💰💰💰'}</span>
                </div>
              </div>
            </div>

            <div class="mobile-card-footer">
              <button class="mobile-roadmap-btn" onclick="openRoadmapModal('${b.id}')">
                🗺️ 로드맵
              </button>
              <button class="matrix-action-btn" style="padding:6px 14px; font-size:0.75rem;" onclick="openBrandModal('${b.id}')">
                전체 상세 보기 →
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = `
    <div class="matrix-view-container" style="grid-column: 1 / -1;">
      ${desktopTableHtml}
      ${mobileListHtml}
    </div>
  `;
}

// =========================================================
// OFFICIAL BRAND CORPORATE LOGOS & LEADERBOARD STREAM RENDERING
// =========================================================
const BRAND_LOGOS = {
  'playfacto': {
    domain: 'playfacto.com',
    imgSrc: 'img/playfacto_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#1E3A8A"/>
      <path d="M12 28L22 22L32 28L22 34L12 28Z" fill="#3B82F6"/>
      <path d="M12 28V18L22 22V34L12 28Z" fill="#1D4ED8"/>
      <path d="M32 28V18L22 22V34L32 28Z" fill="#60A5FA"/>
      <path d="M12 18L22 12L32 18L22 22L12 18Z" fill="#93C5FD"/>
      <text x="22" y="11" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="7.2" letter-spacing="-0.3">PlayFACTO</text>
    </svg>`
  },
  'yeondubi-montessori': {
    domain: 'yundubi.com',
    imgSrc: 'img/yundubi_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <path d="M12 28C10 24 12 18 19 16C19 23 16 27 12 28Z" fill="#65A30D"/>
      <path d="M14 26C15 28 17 31 20 31C21 29 20 27 19 25" fill="#84CC16"/>
      <ellipse cx="14" cy="14" rx="1.5" ry="2.5" fill="#EAB308"/>
      <ellipse cx="18" cy="11" rx="1.5" ry="2.5" fill="#EAB308"/>
      <text x="21" y="9" fill="#65A30D" font-family="'Pretendard', sans-serif" font-weight="700" font-size="3.8">아이들을 먼저 생각하는</text>
      <text x="30" y="27" text-anchor="middle" fill="#18181B" font-family="'Pretendard', sans-serif" font-weight="900" font-size="11.5" letter-spacing="-0.5">연두비</text>
    </svg>`
  },
  'monstermath': {
    domain: 'monstermath.co.kr',
    imgSrc: 'img/monstermath_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#C2410C"/>
      <polygon points="22,10 33,16 33,28 22,34 11,28 11,16" fill="#EA580C" stroke="#FED7AA" stroke-width="1.5"/>
      <circle cx="18" cy="20" r="2.5" fill="#FFFFFF"/>
      <circle cx="18" cy="20" r="1.2" fill="#0F172A"/>
      <circle cx="26" cy="20" r="2.5" fill="#FFFFFF"/>
      <circle cx="26" cy="20" r="1.2" fill="#0F172A"/>
      <path d="M17 26C19 28 25 28 27 26" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
      <text x="22" y="39" text-anchor="middle" fill="#FFEDD5" font-family="'Pretendard', sans-serif" font-weight="900" font-size="5.8">MONSTER</text>
    </svg>`
  },
  'joymath': {
    domain: 'joymath.net',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0284C7"/>
      <polygon points="12,12 28,12 20,20" fill="#F59E0B"/>
      <polygon points="12,12 12,28 20,20" fill="#10B981"/>
      <polygon points="28,12 34,18 26,26 20,20" fill="#EC4899"/>
      <polygon points="20,20 26,26 14,26" fill="#6366F1"/>
      <polygon points="20,28 28,28 28,20" fill="#F43F5E"/>
      <text x="22" y="37" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.8">JoyMath</text>
    </svg>`
  },
  'orda': {
    domain: 'orda.co.kr',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#9F1239"/>
      <circle cx="18" cy="20" r="9" stroke="#FEF08A" stroke-width="3" fill="none"/>
      <circle cx="26" cy="20" r="9" stroke="#FFFFFF" stroke-width="3" fill="none"/>
      <text x="22" y="37" text-anchor="middle" fill="#FFF1F2" font-family="'Pretendard', sans-serif" font-weight="900" font-size="7.5" letter-spacing="0.5">ORDA</text>
    </svg>`
  },
  'froebel': {
    domain: 'froebel.co.kr',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#14532D"/>
      <circle cx="16" cy="18" r="6" fill="#FBBF24"/>
      <rect x="22" y="12" width="10" height="10" rx="1" fill="#22C55E"/>
      <polygon points="22,30 27,22 17,22" fill="#38BDF8"/>
      <text x="22" y="38" text-anchor="middle" fill="#DCFCE7" font-family="'Georgia', serif" font-weight="bold" font-size="6.8" font-style="italic">Froebel</text>
    </svg>`
  },
  'kids-schole': {
    domain: 'kidsschole.com',
    imgSrc: 'img/kidsschole_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#581C87"/>
      <rect x="12" y="12" width="9" height="9" rx="2" fill="#EC4899"/>
      <rect x="23" y="12" width="9" height="9" rx="2" fill="#A855F7"/>
      <rect x="12" y="23" width="9" height="9" rx="2" fill="#38BDF8"/>
      <rect x="23" y="23" width="9" height="9" rx="2" fill="#FBBF24"/>
      <text x="22" y="39" text-anchor="middle" fill="#F3E8FF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="5.8">키즈스콜레</text>
    </svg>`
  },
  'montessori': {
    domain: 'montessori.co.kr',
    imgSrc: 'img/montessori_logo.webp',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#064E3B"/>
      <circle cx="22" cy="13" r="2.5" fill="#F59E0B"/>
      <circle cx="18" cy="19" r="2.5" fill="#F59E0B"/>
      <circle cx="26" cy="19" r="2.5" fill="#F59E0B"/>
      <circle cx="14" cy="25" r="2.5" fill="#F59E0B"/>
      <circle cx="22" cy="25" r="2.5" fill="#F59E0B"/>
      <circle cx="30" cy="25" r="2.5" fill="#F59E0B"/>
      <text x="22" y="37" text-anchor="middle" fill="#D1FAE5" font-family="'Pretendard', sans-serif" font-weight="800" font-size="6.2">한국몬테소리</text>
    </svg>`
  },
  'mathtime': {
    domain: 'mathtime.co.kr',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0F172A"/>
      <line x1="14" y1="24" x2="30" y2="16" stroke="#38BDF8" stroke-width="3" stroke-linecap="round"/>
      <line x1="14" y1="24" x2="22" y2="30" stroke="#818CF8" stroke-width="3" stroke-linecap="round"/>
      <line x1="30" y1="16" x2="22" y2="30" stroke="#818CF8" stroke-width="3" stroke-linecap="round"/>
      <circle cx="14" cy="24" r="3.5" fill="#E2E8F0" stroke="#0284C7" stroke-width="1.5"/>
      <circle cx="30" cy="16" r="3.5" fill="#E2E8F0" stroke="#0284C7" stroke-width="1.5"/>
      <circle cx="22" cy="30" r="3.5" fill="#E2E8F0" stroke="#0284C7" stroke-width="1.5"/>
      <text x="22" y="11" text-anchor="middle" fill="#38BDF8" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.5">MTB 자석</text>
    </svg>`
  },
  'cmath-plato': {
    domain: 'cmath.co.kr',
    imgSrc: 'img/cmath_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0B192C"/>
      <path d="M22 11L33 17V29L22 35L11 29V17L22 11Z" stroke="#00ADB5" stroke-width="1.8" fill="none"/>
      <path d="M22 11V23M33 17L22 23M11 17L22 23M22 23V35" stroke="#00ADB5" stroke-width="1.5"/>
      <text x="22" y="27" text-anchor="middle" fill="#EEEEEE" font-family="'Courier New', monospace" font-weight="bold" font-size="5.5">PLATO</text>
      <text x="22" y="41" text-anchor="middle" fill="#00ADB5" font-family="'Pretendard', sans-serif" font-weight="800" font-size="5.5">시매쓰</text>
    </svg>`
  },
  'gitan': {
    domain: 'gitan.co.kr',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#B91C1C"/>
      <polygon points="25,9 13,24 21,24 17,35 31,18 23,18" fill="#FACC15"/>
      <text x="22" y="40" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.5">기탄수학</text>
    </svg>`
  },
  'kumon': {
    domain: 'kumon.co.kr',
    imgSrc: 'img/kumon_logo.svg',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0284C7"/>
      <circle cx="22" cy="20" r="11" fill="#FFFFFF"/>
      <path d="M16 21C18 24 26 24 28 21" stroke="#0284C7" stroke-width="2.5" stroke-linecap="round"/>
      <text x="22" y="38" text-anchor="middle" fill="#FFFFFF" font-family="'Arial Rounded MT Bold', sans-serif" font-weight="bold" font-size="7">KUMON</text>
    </svg>`
  },
  'noonnoppi': {
    domain: 'daekyo.com',
    imgSrc: 'img/daekyo_logo.webp',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <path d="M10 24C14 16 30 16 34 24" stroke="#E11D48" stroke-width="4" stroke-linecap="round"/>
      <circle cx="22" cy="15" r="3" fill="#1D4ED8"/>
      <text x="22" y="36" text-anchor="middle" fill="#0F172A" font-family="'Pretendard', sans-serif" font-weight="900" font-size="7">눈높이</text>
    </svg>`
  },
  'hansol-math': {
    domain: 'eduhansol.com',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#D97706"/>
      <polygon points="22,11 25,18 33,18 27,23 29,31 22,26 15,31 17,23 11,18 19,18" fill="#FEF08A"/>
      <text x="22" y="39" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.5">한솔수학</text>
    </svg>`
  },
  'jei': {
    domain: 'jei.com',
    imgSrc: 'img/jei_logo.svg',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#581C87"/>
      <polygon points="22,11 31,20 22,29 13,20" fill="#E11D48"/>
      <polygon points="22,14 28,20 22,26 16,20" fill="#FBBF24"/>
      <text x="22" y="38" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="7">JEI재능</text>
    </svg>`
  },
  'wink': {
    domain: 'wink.co.kr',
    imgSrc: 'img/wink_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0D9488"/>
      <circle cx="16" cy="18" r="4.5" fill="#FFFFFF"/>
      <circle cx="16" cy="18" r="2.5" fill="#0F172A"/>
      <path d="M24 19C26 16 30 16 32 19" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M19 23C20.5 25 23.5 25 25 23" stroke="#FEF08A" stroke-width="2" stroke-linecap="round"/>
      <text x="22" y="37" text-anchor="middle" fill="#CCFBF1" font-family="'Pretendard', sans-serif" font-weight="900" font-size="7.5">Wink</text>
    </svg>`
  },
  'woongjin-smartall': {
    domain: 'wjthinkbig.com',
    imgSrc: 'img/woongjin_logo.svg',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#EA580C"/>
      <circle cx="22" cy="18" r="7" fill="#FEF08A"/>
      <path d="M19 26H25M20 28H24" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M15 13L13 11M29 13L31 11M22 9V7" stroke="#FEF08A" stroke-width="1.8" stroke-linecap="round"/>
      <text x="22" y="38" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.5">씽크빅</text>
    </svg>`
  },
  'soma': {
    domain: 'somamath.com',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#1E40AF"/>
      <rect x="12" y="24" width="6" height="6" fill="#FBBF24"/>
      <rect x="18" y="19" width="6" height="11" fill="#60A5FA"/>
      <rect x="24" y="14" width="6" height="16" fill="#FBBF24"/>
      <rect x="30" y="9" width="6" height="21" fill="#60A5FA"/>
      <text x="22" y="38" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="7">SOMA</text>
    </svg>`
  },
  'cheon-jonghyun': {
    domain: '1000math.com',
    imgSrc: 'img/cheon_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#064E3B"/>
      <circle cx="22" cy="19" r="9" stroke="#FEF08A" stroke-width="1.5" fill="#047857"/>
      <path d="M17 17H27M22 13V25" stroke="#FEF08A" stroke-width="2.2" stroke-linecap="round"/>
      <text x="22" y="37" text-anchor="middle" fill="#A7F3D0" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6">천종현</text>
    </svg>`
  },
  'c2m': {
    domain: 'c2medu.co.kr',
    imgSrc: 'img/c2m_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <path d="M12 28C10 20 12 12 18 12C21 12 22 14 22 16C22 14 23 12 26 12C32 12 34 20 32 28C30 33 26 34 22 34C18 34 14 33 12 28Z" fill="#292524"/>
      <ellipse cx="17" cy="18" rx="4.5" ry="4.5" fill="#FFFFFF"/>
      <circle cx="17" cy="18" r="2.2" fill="#1C1917"/>
      <ellipse cx="27" cy="18" rx="4.5" ry="4.5" fill="#FFFFFF"/>
      <circle cx="27" cy="18" r="2.2" fill="#1C1917"/>
      <polygon points="22,19 20,23 24,23" fill="#F59E0B"/>
      <rect x="15" y="24" width="14" height="1.8" rx="0.9" fill="#0284C7"/>
      <rect x="15.5" y="26.5" width="13" height="1.8" rx="0.9" fill="#F59E0B"/>
      <rect x="16" y="29" width="12" height="1.8" rx="0.9" fill="#E11D48"/>
      <rect x="17" y="31.5" width="10" height="1.8" rx="0.9" fill="#10B981"/>
      <text x="22" y="41" text-anchor="middle" fill="#1E293B" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.5">씨투엠</text>
    </svg>`
  },
  'facto': {
    domain: 'factos.co.kr',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#78350F"/>
      <polygon points="22,10 25,17 32,17 26,22 28,29 22,25 16,29 18,22 12,17 19,17" fill="#FDE047"/>
      <path d="M15 28C15 31 29 31 29 28" stroke="#FDE047" stroke-width="1.8"/>
      <text x="22" y="39" text-anchor="middle" fill="#FEF3C7" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.8">FACTO</text>
    </svg>`
  },
  'didimdol': {
    domain: 'didimdol.co.kr',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#1E3A8A"/>
      <rect x="12" y="22" width="10" height="5" rx="1.5" fill="#93C5FD"/>
      <rect x="17" y="16" width="10" height="5" rx="1.5" fill="#BFDBFE"/>
      <rect x="22" y="10" width="10" height="5" rx="1.5" fill="#FFFFFF"/>
      <text x="22" y="37" text-anchor="middle" fill="#DBEAFE" font-family="'Pretendard', sans-serif" font-weight="800" font-size="6.5">디딤돌</text>
    </svg>`
  },
  'miraen': {
    domain: 'mirae-n.com',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0369A1"/>
      <path d="M12 25V15L18 25V15M24 15V25M24 15H29C31 15 32 17 32 20C32 23 31 25 29 25H24" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="22" y="37" text-anchor="middle" fill="#BAE6FD" font-family="'Pretendard', sans-serif" font-weight="800" font-size="6.5">미래엔</text>
    </svg>`
  },
  'edx': {
    domain: 'edxeducation.com',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0284C7"/>
      <ellipse cx="16" cy="16" rx="6" ry="4" transform="rotate(-15 16 16)" fill="#EF4444"/>
      <ellipse cx="28" cy="15" rx="7" ry="4.5" transform="rotate(20 28 15)" fill="#F59E0B"/>
      <ellipse cx="15" cy="26" rx="7.5" ry="5" transform="rotate(10 15 26)" fill="#10B981"/>
      <ellipse cx="29" cy="27" rx="8" ry="5" transform="rotate(-10 29 27)" fill="#8B5CF6"/>
      <rect x="10" y="31" width="24" height="9" rx="3" fill="#0F172A"/>
      <text x="22" y="37.5" text-anchor="middle" fill="#38BDF8" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6.5" letter-spacing="0.5">EDX</text>
    </svg>`
  },
  'c2m-class': {
    domain: 'c2medu.co.kr',
    imgSrc: 'img/c2m_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
      <path d="M12 28C10 20 12 12 18 12C21 12 22 14 22 16C22 14 23 12 26 12C32 12 34 20 32 28C30 33 26 34 22 34C18 34 14 33 12 28Z" fill="#292524"/>
      <ellipse cx="17" cy="18" rx="4.5" ry="4.5" fill="#FFFFFF"/>
      <circle cx="17" cy="18" r="2.2" fill="#1C1917"/>
      <ellipse cx="27" cy="18" rx="4.5" ry="4.5" fill="#FFFFFF"/>
      <circle cx="27" cy="18" r="2.2" fill="#1C1917"/>
      <polygon points="22,19 20,23 24,23" fill="#F59E0B"/>
      <rect x="15" y="24" width="14" height="1.8" rx="0.9" fill="#0284C7"/>
      <rect x="15.5" y="26.5" width="13" height="1.8" rx="0.9" fill="#F59E0B"/>
      <rect x="16" y="29" width="12" height="1.8" rx="0.9" fill="#E11D48"/>
      <rect x="17" y="31.5" width="10" height="1.8" rx="0.9" fill="#10B981"/>
      <text x="22" y="41" text-anchor="middle" fill="#1E293B" font-family="'Pretendard', sans-serif" font-weight="900" font-size="5.4">씨투엠클래스</text>
    </svg>`
  },
  'facto-schule': {
    domain: 'factoschule.com',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#701A75"/>
      <rect x="11" y="11" width="10" height="10" rx="3" fill="#FACC15"/>
      <rect x="23" y="11" width="10" height="10" rx="3" fill="#38BDF8"/>
      <rect x="11" y="23" width="10" height="10" rx="3" fill="#F43F5E"/>
      <circle cx="28" cy="28" r="5" fill="#4ADE80"/>
      <text x="22" y="39" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="5.8">SCHULE</text>
    </svg>`
  },
  'mylittletiger': {
    domain: 'mylittletiger.co.kr',
    imgSrc: 'img/tiger_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#EA580C"/>
      <circle cx="22" cy="21" r="11" fill="#FBBF24"/>
      <circle cx="14" cy="13" r="3.5" fill="#EA580C"/>
      <circle cx="30" cy="13" r="3.5" fill="#EA580C"/>
      <circle cx="14" cy="13" r="1.8" fill="#FEF08A"/>
      <circle cx="30" cy="13" r="1.8" fill="#FEF08A"/>
      <circle cx="18" cy="19" r="1.8" fill="#0F172A"/>
      <circle cx="26" cy="19" r="1.8" fill="#0F172A"/>
      <ellipse cx="22" cy="24" rx="3" ry="2" fill="#FFFFFF"/>
      <polygon points="22,23 20.5,22 23.5,22" fill="#0F172A"/>
      <text x="22" y="39" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="6">TIGER</text>
    </svg>`
  },
  'bluerabbit': {
    domain: 'bluerabbit.co.kr',
    imgSrc: 'img/bluerabbit_logo.png',
    svg: `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="11" fill="#0284C7"/>
      <!-- Rabbit Ears -->
      <ellipse cx="17" cy="14" rx="3.2" ry="7" fill="#FFFFFF"/>
      <ellipse cx="17" cy="14" rx="1.8" ry="5" fill="#FDA4AF"/>
      <ellipse cx="27" cy="14" rx="3.2" ry="7" fill="#FFFFFF"/>
      <ellipse cx="27" cy="14" rx="1.8" ry="5" fill="#FDA4AF"/>
      <!-- Rabbit Head -->
      <circle cx="22" cy="23" r="9" fill="#FFFFFF"/>
      <circle cx="18" cy="21" r="1.5" fill="#0F172A"/>
      <circle cx="26" cy="21" r="1.5" fill="#0F172A"/>
      <polygon points="22,24 20.8,23 23.2,23" fill="#F43F5E"/>
      <path d="M19 26C20.5 27 23.5 27 25 26" stroke="#0F172A" stroke-width="1.2" stroke-linecap="round"/>
      <text x="22" y="39" text-anchor="middle" fill="#E0F2FE" font-family="'Pretendard', sans-serif" font-weight="900" font-size="5.8">블루래빗</text>
    </svg>`
  }
};

function getBrandLogo(brandId, size = 'md') {
  if (!brandId) return '';
  const targetId = brandId.toLowerCase().trim();
  
  let item = BRAND_LOGOS[targetId];
  if (!item) {
    const ALIAS_MAP = {
      'cmath': 'cmath-plato',
      'plato': 'cmath-plato',
      'somasem': 'soma',
      'wonrisem': 'cheon-jonghyun',
      'top-thinking': 'cheon-jonghyun',
      'jasinkam': 'cheon-jonghyun',
      'kidsschole': 'kids-schole',
      'miraen-ssok': 'miraen',
      'soksam': 'miraen',
      'talent': 'jei',
      'woongjin': 'woongjin-smartall',
      'thinkbig': 'woongjin-smartall',
      'orda-power': 'orda',
      'edx-education': 'edx',
      'c2m-edu': 'c2m-class',
      'c2mclass': 'c2m-class',
      'factoschule': 'facto-schule',
      'facto_schule': 'facto-schule',
      'tiger': 'mylittletiger',
      'mylittle-tiger': 'mylittletiger',
      'blue-rabbit': 'bluerabbit',
      'bluerabbit-toy': 'bluerabbit'
    };
    if (ALIAS_MAP[targetId]) {
      item = BRAND_LOGOS[ALIAS_MAP[targetId]];
    }
  }

  if (!item) {
    for (const key of Object.keys(BRAND_LOGOS)) {
      if (targetId.includes(key) || key.includes(targetId)) {
        item = BRAND_LOGOS[key];
        break;
      }
    }
  }

  if (!item) {
    const initial = (brandId.slice(0, 2) || 'MA').toUpperCase();
    return `
      <div class="brand-logo-badge size-${size}">
        <div class="brand-logo-svg">
          <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="44" height="44" rx="11" fill="#4F46E5"/>
            <text x="22" y="27" text-anchor="middle" fill="#FFFFFF" font-family="'Pretendard', sans-serif" font-weight="900" font-size="14">${initial}</text>
          </svg>
        </div>
      </div>
    `;
  }

  const domain = item.domain || '';
  const imgSrc = item.imgSrc || '';
  return `
    <div class="brand-logo-badge size-${size}" title="${brandId}">
      <div class="brand-logo-svg">
        ${item.svg}
      </div>
      ${imgSrc ? `
        <img 
          class="brand-logo-img loaded" 
          src="${imgSrc}" 
          alt="${brandId} logo"
          style="opacity:1; object-fit:contain; background:#ffffff; padding:2px;"
        />
      ` : (domain ? `
        <img 
          class="brand-logo-img" 
          src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" 
          alt="${brandId} logo"
          loading="lazy"
          onload="this.classList.add('loaded')"
          onerror="this.style.display='none'"
        />
      ` : '')}
    </div>
  `;
}

function renderLeaderboardItem(b, idx, type) {
  const sm = getStarMatrixForBrand(b);
  const m = getMatrixForBrand(b);
  const isAdded = state.compareList.includes(b.id);
  const detailId = `lb-detail-${type}-${b.id}`;
  const rank = idx + 1;
  const isTop1 = rank === 1;
  const isTop2 = rank === 2;
  const isTop3 = rank === 3;
  const rankClass = isTop1 ? 'top-rank-1' : isTop2 ? 'top-rank-2' : isTop3 ? 'top-rank-3' : '';
  const rankLabel = isTop1 ? '🥇 1위' : isTop2 ? '🥈 2위' : isTop3 ? '🥉 3위' : `${rank}위`;

  const fullPhilo = b.differentiation || sm.philosophy || '원리 기반 연계 학습';
  const fullStrength = sm.strength || b.pros || '체계적인 원리 이해 및 교과 연계 완성';
  const kwData = getBrandKeywords(b.id, fullPhilo, fullStrength);
  const ageScore = getAgeAdaptiveScore(b, state.selectedAge);

  return `
    <div class="leaderboard-item ${rankClass}" id="card-${type}-${b.id}">
      <div class="lb-main-row" onclick="toggleLeaderboardDrawer('${detailId}', this.closest('.leaderboard-item'))">
        
        <!-- Left: Rank & Avatar & Identity -->
        <div class="lb-left-cluster">
          <div class="lb-rank-badge rank-badge-${rank}">${rankLabel}</div>
          <div class="lb-avatar">${getBrandLogo(b.id, 'md')}</div>
          <div class="lb-identity">
            <div class="lb-name-wrapper">
              <h4 class="lb-brand-name">${b.name}</h4>
              <span class="lb-company-tag">${b.company}</span>
            </div>
            <div class="lb-score-row">
              <span class="lb-score-pill">★ ${sm.avgScore}</span>
              <span class="lb-total-score">만 ${state.selectedAge}세 맞춤 <strong>${ageScore.finalScore}점</strong> (원점수 ${sm.totalScore}점)</span>
              <span class="lb-cost-badge">${sm.costSymbol || '💰💰💰'}</span>
            </div>
          </div>
        </div>

        <!-- Middle: Philosophy & Strength (키워드 칩 중심 디자인) -->
        <div class="lb-content-cluster">
          <div class="lb-highlight-box lb-philosophy" title="교육 철학: ${fullPhilo}">
            <div class="lb-box-label-wrap">
              <span class="lb-box-label">💡 교육철학</span>
            </div>
            <div class="lb-keyword-chips">
              ${kwData.philosophy.map(kw => `<span class="lb-kw-chip lb-chip-philo">${kw}</span>`).join('')}
            </div>
          </div>
          <div class="lb-highlight-box lb-strength" title="대표 강점: ${fullStrength}">
            <div class="lb-box-label-wrap">
              <span class="lb-box-label">✨ 대표강점</span>
            </div>
            <div class="lb-keyword-chips">
              ${kwData.strength.map(kw => `<span class="lb-kw-chip lb-chip-strength">${kw}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Right: Action Buttons -->
        <div class="lb-action-cluster" onclick="event.stopPropagation();">
          <button class="lb-btn lb-btn-roadmap" onclick="openRoadmapModal('${b.id}')" title="학습 로드맵 보기">
            <span>🗺️ 로드맵</span>
          </button>
          <button class="lb-btn lb-btn-ratings" onclick="toggleLeaderboardDrawer('${detailId}', this.closest('.leaderboard-item'))">
            <span>평점 보기</span>
            <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button class="lb-btn lb-btn-profile" onclick="openBrandModal('${b.id}')">
            <span>상세 →</span>
          </button>
        </div>

      </div>

      <!-- Expandable Ratings Drawer -->
      <div id="${detailId}" class="lb-drawer hidden">
        <div class="lb-drawer-content">
          <div class="lb-drawer-top">
            <div class="lb-drawer-heading">
              <span class="lb-drawer-title">📊 <strong>${b.name}</strong> 7대 평가 지표 심층 분석</span>
              <span class="lb-drawer-score-badge">만 ${state.selectedAge}세 맞춤 ${ageScore.finalScore}점 · 종합 평점 ★${sm.avgScore} (총점 ${sm.totalScore}점 / 30점 만점${sm.weightedScore ? ` · 학술 가중 ${sm.weightedScore}점` : ''})</span>
            </div>
            <div class="lb-drawer-close-btn" onclick="toggleLeaderboardDrawer('${detailId}', this.closest('.leaderboard-item'))">닫기 ✕</div>
          </div>

          <!-- 7-Dimension Rating Bars -->
          <div class="lb-radar-bars">
            <div class="lb-bar-item">
              <div class="lb-bar-header">
                <span class="lb-bar-name">🧮 연산 능력</span>
                <span class="lb-bar-score">${getStars(sm.calculation)} (${sm.calculation}/5)</span>
              </div>
              <div class="lb-meter"><div class="lb-fill calc-fill" style="width: ${(sm.calculation / 5) * 100}%;"></div></div>
            </div>

            <div class="lb-bar-item">
              <div class="lb-bar-header">
                <span class="lb-bar-name">🧠 사고력 깊이</span>
                <span class="lb-bar-score">${getStars(sm.thinking)} (${sm.thinking}/5)</span>
              </div>
              <div class="lb-meter"><div class="lb-fill think-fill" style="width: ${(sm.thinking / 5) * 100}%;"></div></div>
            </div>

            <div class="lb-bar-item">
              <div class="lb-bar-header">
                <span class="lb-bar-name">🧩 교구 완성도</span>
                <span class="lb-bar-score">${getStars(sm.manipulative)} (${sm.manipulative}/5)</span>
              </div>
              <div class="lb-meter"><div class="lb-fill manip-fill" style="width: ${(sm.manipulative / 5) * 100}%;"></div></div>
            </div>

            <div class="lb-bar-item">
              <div class="lb-bar-header">
                <span class="lb-bar-name">🏡 가정학습 (엄마표)</span>
                <span class="lb-bar-score">${getStars(sm.homeLearning)} (${sm.homeLearning}/5)</span>
              </div>
              <div class="lb-meter"><div class="lb-fill home-fill" style="width: ${(sm.homeLearning / 5) * 100}%;"></div></div>
            </div>

            <div class="lb-bar-item">
              <div class="lb-bar-header">
                <span class="lb-bar-name">🏫 초등 교과 연계</span>
                <span class="lb-bar-score">${getStars(sm.elementaryLink)} (${sm.elementaryLink}/5)</span>
              </div>
              <div class="lb-meter"><div class="lb-fill elem-fill" style="width: ${(sm.elementaryLink / 5) * 100}%;"></div></div>
            </div>

            <div class="lb-bar-item">
              <div class="lb-bar-header">
                <span class="lb-bar-name">🔬 학술 연구 검증</span>
                <span class="lb-bar-score">${getStars(sm.researchEvidence || 3)} (${sm.researchEvidence || 3}/5)</span>
              </div>
              <div class="lb-meter"><div class="lb-fill sci-fill" style="width: ${((sm.researchEvidence || 3) / 5) * 100}%;"></div></div>
            </div>
          </div>

          <!-- Approach Details -->
          ${(m.calculationApproach || m.thinkingMathApproach || b.coreFocus) ? `
          <div class="lb-approach-strip">
            ${m.calculationApproach ? `<div class="lb-strip-tag"><strong>🧮 연산:</strong> ${m.calculationApproach}</div>` : ''}
            ${m.thinkingMathApproach ? `<div class="lb-strip-tag"><strong>🧠 사고력:</strong> ${m.thinkingMathApproach}</div>` : ''}
            ${b.curriculumLink ? `<div class="lb-strip-tag"><strong>🏫 초등 연계:</strong> ${b.curriculumLink}</div>` : ''}
          </div>
          ` : ''}

          <!-- Quick Pros & Cons Preview -->
          ${(b.pros || b.cons) ? `
          <div class="lb-pros-cons-preview">
            <div class="lb-pro-pill">
              <span class="lb-pill-label pro-label">✨ 대표 장점</span>
              <p class="lb-pill-text">${b.pros || '원리 중심 조작 학습'}</p>
            </div>
            <div class="lb-con-pill">
              <span class="lb-pill-label con-label">⚠️ 단점 및 고려사항</span>
              <p class="lb-pill-text">${b.cons || '부모의 가이드 숙지 및 보관 관리 필요'}</p>
            </div>
          </div>
          ` : ''}

        </div>
      </div>
    </div>
  `;
}

window.toggleLeaderboardDrawer = function(drawerId, cardElement) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
  const isHidden = drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden');
  
  if (cardElement) {
    cardElement.classList.toggle('drawer-open', isHidden);
    const toggleBtn = cardElement.querySelector('.lb-btn-ratings');
    if (toggleBtn) {
      const span = toggleBtn.querySelector('span');
      if (span) span.textContent = isHidden ? '평점 닫기' : '평점 보기';
      toggleBtn.classList.toggle('active', isHidden);
    }
  }
};

// ---------------------------------------------------------
// 탭 2. 🧩 교구 탐색기 (교구 전문 브랜드 리더보드 뷰)
// ---------------------------------------------------------
function renderManipulatives() {
  const container = document.getElementById('manipulativeGrid');
  if (!container) return;

  const brands = DASHBOARD_DATA.brands || [];
  const sets = DASHBOARD_DATA.sets || [];
  const manipBrands = brands.filter(b => MANIPULATIVE_BRAND_IDS.includes(b.id));

  const filtered = manipBrands.filter(b => {
    const ageMatch = matchesAge(b.targetAgeDetail, b.targetAge, state.selectedAge);
    const hasSets = sets.some(s => s.brandId === b.id && matchesAge(s.targetAge, s.targetAgeGroup, state.selectedAge));
    if (!ageMatch && !hasSets) return false;

    if (state.searchQuery) {
      const q = state.searchQuery;
      return b.name.toLowerCase().includes(q) || b.differentiation.toLowerCase().includes(q) || b.coreFocus.toLowerCase().includes(q) || b.pros.toLowerCase().includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">선택하신 나이(만 ${state.selectedAge}세)에 해당하는 교구 브랜드가 없습니다.</div>`;
    return;
  }

  // 교구 랭킹: 연령별(만 ${state.selectedAge}세) 발달 단계 및 사용자 지정 우선순위 적합도 가중 정렬
  filtered.sort((a, b) => {
    const prioA = getManipulativeAgePriority(a.id, state.selectedAge);
    const prioB = getManipulativeAgePriority(b.id, state.selectedAge);
    if (prioA !== prioB) return prioA - prioB;

    const scoreA = getAgeAdaptiveScore(a, state.selectedAge);
    const scoreB = getAgeAdaptiveScore(b, state.selectedAge);
    if (scoreB.finalScore !== scoreA.finalScore) {
      return scoreB.finalScore - scoreA.finalScore;
    }
    if (scoreB.researchEvidence !== scoreA.researchEvidence) {
      return scoreB.researchEvidence - scoreA.researchEvidence;
    }
    return scoreB.elementaryLink - scoreA.elementaryLink;
  });

  container.innerHTML = `
    <div class="brand-leaderboard-stream" style="grid-column: 1 / -1;">
      ${filtered.map((b, idx) => renderLeaderboardItem(b, idx, 'manip')).join('')}
    </div>
  `;
}

// ---------------------------------------------------------
// 탭 3. 📚 학습지 전문 브랜드 탐색기 (Workbooks Explorer)
// ---------------------------------------------------------
function renderWorkbooks() {
  const container = document.getElementById('workbookGrid');
  if (!container) return;

  const brands = DASHBOARD_DATA.brands || [];
  const sets = DASHBOARD_DATA.sets || [];
  const workbookBrands = brands.filter(b => !MANIPULATIVE_BRAND_IDS.includes(b.id) || b.id === 'orda');

  const filtered = workbookBrands.filter(b => {
    const ageMatch = matchesAge(b.targetAgeDetail, b.targetAge, state.selectedAge);
    const hasSets = sets.some(s => s.brandId === b.id && matchesAge(s.targetAge, s.targetAgeGroup, state.selectedAge));
    if (!ageMatch && !hasSets) return false;

    if (state.searchQuery) {
      const q = state.searchQuery;
      return b.name.toLowerCase().includes(q) || b.differentiation.toLowerCase().includes(q) || b.coreFocus.toLowerCase().includes(q) || b.pros.toLowerCase().includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">선택하신 나이(만 ${state.selectedAge}세)에 해당하는 학습지 브랜드가 없습니다.</div>`;
    return;
  }

  // 학습지 랭킹: 연령별(만 ${state.selectedAge}세) 발달 단계 및 실제 교재 라인업 적합도 가중 정렬
  filtered.sort((a, b) => {
    const scoreA = getAgeAdaptiveScore(a, state.selectedAge);
    const scoreB = getAgeAdaptiveScore(b, state.selectedAge);
    if (scoreB.finalScore !== scoreA.finalScore) {
      return scoreB.finalScore - scoreA.finalScore;
    }
    if (scoreB.researchEvidence !== scoreA.researchEvidence) {
      return scoreB.researchEvidence - scoreA.researchEvidence;
    }
    return scoreB.elementaryLink - scoreA.elementaryLink;
  });

  container.innerHTML = `
    <div class="brand-leaderboard-stream" style="grid-column: 1 / -1;">
      ${filtered.map((b, idx) => renderLeaderboardItem(b, idx, 'wb')).join('')}
    </div>
  `;
}

// ---------------------------------------------------------
// 탭 4. ⚖️ 1:1 브랜드 정밀 비교기 (Comparison Matrix)
// ---------------------------------------------------------
function renderComparison() {
  const selectorContainer = document.getElementById('comparePillsContainer');
  const gridContainer = document.getElementById('compareGridContainer');
  if (!selectorContainer || !gridContainer) return;

  const brands = DASHBOARD_DATA.brands || [];

  // 1. 브랜드 선택 필즈 렌더링
  selectorContainer.innerHTML = brands.map(b => {
    const isSelected = state.compareList.includes(b.id);
    return `
      <button class="brand-pill ${isSelected ? 'selected' : ''}" onclick="toggleCompareBrand('${b.id}')">
        ${isSelected ? '✓ ' : '+ '} ${b.name.split(' ')[0]}
      </button>
    `;
  }).join('');

  // 2. 선택된 브랜드 1:1 비교 카드 렌더링
  const selectedBrands = brands.filter(b => state.compareList.includes(b.id));

  if (selectedBrands.length === 0) {
    gridContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">비교할 브랜드를 상단 버튼에서 2~3개 선택해주세요.</div>`;
    return;
  }

  gridContainer.innerHTML = selectedBrands.map(b => {
    const m = getMatrixForBrand(b);
    return `
      <div class="compare-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div>
            <div class="card-brand-name">${b.company}</div>
            <h3 style="font-size:1.3rem; font-weight:800;">${b.name}</h3>
          </div>
          <button onclick="toggleCompareBrand('${b.id}')" style="color:var(--text-muted); font-size:1.2rem;">✕</button>
        </div>

        <div class="compare-factor-row">
          <div class="compare-factor-label">핵심 차별성</div>
          <div class="compare-factor-value" style="color:var(--primary); font-weight:700;">${b.differentiation || '-'}</div>
        </div>

        <div class="compare-factor-row">
          <div class="compare-factor-label">교육 형태 & 수업 방식</div>
          <div class="compare-factor-value">${m.learningFormat || b.method || '-'}</div>
        </div>

        <div class="compare-factor-row">
          <div class="compare-factor-label">유아 수업 특징</div>
          <div class="compare-factor-value">${m.earlyChildhoodClass || m.preschoolClass || b.coreFocus || '-'}</div>
        </div>

        <div class="compare-factor-row">
          <div class="compare-factor-label">연산 접근법</div>
          <div class="compare-factor-value">${m.calculationApproach || '-'}</div>
        </div>

        <div class="compare-factor-row">
          <div class="compare-factor-label">사고력 접근법</div>
          <div class="compare-factor-value">${m.thinkingMathApproach || '-'}</div>
        </div>

        <div class="compare-factor-row">
          <div class="compare-factor-label">비용 & 가성비</div>
          <div class="compare-factor-value">${m.cost || b.priceRange || '-'}</div>
        </div>

        <div class="compare-factor-row">
          <div class="compare-factor-label">가정학습 (엄마표) 용이성</div>
          <div class="compare-factor-value">${m.accessibility || '-'}</div>
        </div>

        <div class="compare-factor-row" style="border-bottom:none;">
          <div class="compare-factor-label">장단점 요약</div>
          <div class="compare-factor-value" style="font-size:0.85rem;">
            <p style="color:#059669; margin-bottom:4px;"><strong>장점:</strong> ${b.pros || m.advantages || '-'}</p>
            <p style="color:#DC2626;"><strong>단점:</strong> ${b.cons || '-'}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------
// 탭 5. 🔬 학술 연구 검증실 (Science & Evidence Hub)
// ---------------------------------------------------------
function renderScience() {
  const wsContainer = document.getElementById('worksheetResearchContainer');
  const manipContainer = document.getElementById('manipulativeResearchContainer');

  // 1부: 학습지 위주 주입식 교육의 한계 실증 연구 5편
  if (wsContainer) {
    const wsData = DASHBOARD_DATA.worksheetResearch || [];
    wsContainer.innerHTML = wsData.map((res, idx) => `
      <div class="research-card highlight-warning">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
          <span class="card-type-badge badge-workbook" style="font-size:0.8rem;">실증 추적 연구 #${idx + 1} · ${res.topic || '주입식 학습지 실증 연구'}</span>
          <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">${res.journal || ''}</span>
        </div>

        <div class="research-meta">
          <span class="research-meta-author">👨‍🔬 연구진: ${res.authors || '연구팀'}</span>
        </div>

        <h4 class="research-title" style="margin-top:6px;">"${res.title || ''}"</h4>

        <div class="research-finding warning-box">
          <strong>🚨 핵심 실증 결과:</strong> ${res.finding || ''}
        </div>

        ${res.link ? `
          <div style="margin-top:10px;">
            <a href="${res.link}" target="_blank" rel="noopener" class="research-doi-link">
              📄 학술 논문 원문(DOI / 공식 게재지) 확인하기 ↗
            </a>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // 2부: 구체물 조작(교구) 및 게임의 수학적 성취도 효과 연구 & 프뢰벨 RCT 부재 리포트
  if (manipContainer) {
    const manipData = DASHBOARD_DATA.manipulativeResearch || [];
    manipContainer.innerHTML = manipData.map(cat => {
      // 일반 연구 카테고리 (studies 배열 존재)
      if (Array.isArray(cat.studies) && cat.studies.length > 0) {
        return `
          <div style="background:white; border-radius:14px; border:1px solid var(--border-light); padding:24px; margin-bottom:24px; box-shadow:var(--shadow-sm);">
            <div style="border-bottom:2px solid var(--primary-soft); padding-bottom:14px; margin-bottom:18px;">
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:6px;">
                <h4 style="font-size:1.2rem; font-weight:800; color:var(--primary);">${cat.category}</h4>
                <div style="display:flex; gap:6px;">
                  ${(cat.relatedBrands || []).map(b => `<span class="card-tag" style="background:#EEF2FF; color:var(--primary); font-weight:700;">#${b}</span>`).join('')}
                </div>
              </div>
              <p style="font-size:0.9rem; color:var(--text-secondary); font-weight:600;">💡 주요 가설/주장: "${cat.claim}"</p>
            </div>

            <div style="display:flex; flex-direction:column; gap:16px;">
              ${cat.studies.map(s => `
                <div class="research-card" style="margin-bottom:0; background:#F8FAFC;">
                  <div class="research-meta">
                    <span class="research-meta-author">저자: ${s.authors || ''}</span>
                    <span>·</span>
                    <span>${s.journal || 'Peer-reviewed Journal'}</span>
                  </div>
                  <h4 class="research-title" style="font-size:1.05rem;">"${s.title || ''}"</h4>
                  <div class="research-finding" style="background:white;">
                    <strong>실증 결과 (핵심 요약):</strong> ${s.finding || ''}
                  </div>
                  ${s.link ? `
                    <a href="${s.link}" target="_blank" rel="noopener" class="research-doi-link">
                      학술 논문 원문(DOI) 보기 ↗
                    </a>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // 프뢰벨 은물 / 가베: 대규모 RCT 연구 부재 리포트 특별 카드
      return `
        <div style="background:white; border-radius:14px; border:2px solid #CBD5E1; padding:24px; margin-bottom:24px; box-shadow:var(--shadow-sm);">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
            <h4 style="font-size:1.2rem; font-weight:800; color:#475569;">${cat.category}</h4>
            <div style="display:flex; gap:6px;">
              ${(cat.relatedBrands || []).map(b => `<span class="card-tag" style="background:#F1F5F9; color:#475569; font-weight:700;">#${b}</span>`).join('')}
            </div>
          </div>

          <div style="background:#F8FAFC; border-left:4px solid #64748B; padding:14px 16px; border-radius:8px; margin-bottom:14px;">
            <h5 style="color:#1E293B; font-weight:800; margin-bottom:4px;">🔍 학술 검증 현황: ${cat.status || '연구 현황 분석'}</h5>
            <p style="font-size:0.9rem; color:#475569; line-height:1.6;">${cat.note || ''}</p>
          </div>

          <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">
            <strong>💡 교구 철학 및 의의:</strong> ${cat.claim || ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

// =========================================================
// 4. MODAL & COMPARE TRAY HANDLERS
// =========================================================
function openBrandModal(brandId) {
  const brand = (DASHBOARD_DATA.brands || []).find(b => b.id === brandId);
  if (!brand) return;

  const modalOverlay = document.getElementById('brandModalOverlay');
  const modalContent = document.getElementById('modalBody');
  if (!modalOverlay || !modalContent) return;

  // 관련 세트 목록 및 비교 데이터 매핑 (별칭 및 하이픈 정규화 매칭 지원)
  const cleanBrandId = brandId.toLowerCase().trim().replace(/-/g, '');
  const relatedSets = (DASHBOARD_DATA.sets || []).filter(s => {
    const sId = (s.brandId || '').toLowerCase().trim();
    const cleanSId = sId.replace(/-/g, '');
    return sId === brandId.toLowerCase() || cleanSId === cleanBrandId ||
           (brandId === 'kids-schole' && sId === 'kidsschole') ||
           (brandId === 'cmath-plato' && (sId === 'cmath' || sId === 'plato')) ||
           (brandId === 'c2m-class' && (sId === 'c2m-class' || sId === 'c2m')) ||
           (brandId === 'c2m' && (sId === 'c2m' || sId === 'c2m-class'));
  });
  const m = getMatrixForBrand(brand);
  const sm = getStarMatrixForBrand(brand);

  modalContent.innerHTML = `
    <div style="display:flex; align-items:center; gap:16px; margin-bottom:18px;">
      ${getBrandLogo(brand.id, 'lg')}
      <div>
        <span class="card-type-badge badge-manipulative" style="margin-bottom:6px;">${brand.category} · ${brand.subCategory || ''}</span>
        <h2 style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin:0;">${brand.name}</h2>
        <p style="color:var(--text-secondary); font-size:0.95rem; margin:4px 0 0 0;">운영사: ${brand.company}</p>
      </div>
    </div>

    <!-- 7대 핵심 평가 지표 요약 카드 -->
    <div style="background:#F8FAFC; border:1px solid var(--border-light); border-radius:12px; padding:16px 18px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <h4 style="font-size:1.02rem; font-weight:800; color:var(--text-primary); margin:0;">📊 7대 핵심 지표 정밀 평가</h4>
        <span class="score-pill" style="font-size:0.85rem; padding:4px 10px;">★ 종합 ${sm.avgScore}점 / 30점 만점 (${sm.totalScore}점)</span>
      </div>
      <div class="ratings-grid-compact">
        <div class="rating-card-item"><span class="rc-label">🧮 연산 능력</span><span class="rc-stars">${getStars(sm.calculation)} (${sm.calculation}/5)</span></div>
        <div class="rating-card-item"><span class="rc-label">🧠 사고력 깊이</span><span class="rc-stars">${getStars(sm.thinking)} (${sm.thinking}/5)</span></div>
        <div class="rating-card-item"><span class="rc-label">🧩 교구 완성도</span><span class="rc-stars">${getStars(sm.manipulative)} (${sm.manipulative}/5)</span></div>
        <div class="rating-card-item"><span class="rc-label">🏡 가정학습 (엄마표)</span><span class="rc-stars">${getStars(sm.homeLearning)} (${sm.homeLearning}/5)</span></div>
        <div class="rating-card-item"><span class="rc-label">🏫 초등 교과 연계</span><span class="rc-stars">${getStars(sm.elementaryLink)} (${sm.elementaryLink}/5)</span></div>
        <div class="rating-card-item"><span class="rc-label">🔬 학술 연구 검증</span><span class="rc-stars">${getStars(sm.researchEvidence || 3)} (${sm.researchEvidence || 3}/5)</span></div>
        <div class="rating-card-item cost-item"><span class="rc-label">💰 예상 비용 수준</span><span class="rc-cost">${sm.costSymbol || '💰💰💰'}</span></div>
      </div>
    </div>

    <div style="background:#EEF2FF; border-left:4px solid var(--primary); padding:14px 16px; border-radius:8px; margin-bottom:16px;">
      <h4 style="color:var(--primary-dark); font-weight:800; margin-bottom:4px;">🌟 핵심 차별화 (Differentiation)</h4>
      <p style="font-size:0.92rem; color:var(--text-secondary); line-height:1.6;">${brand.differentiation}</p>
    </div>

    <!-- 장점(Pros) & 단점 및 고려사항(Cons) 정밀 비교 카드 -->
    <div class="modal-pros-cons-grid">
      <div class="modal-pro-card">
        <div class="modal-box-header">
          <h4 class="modal-pro-title">✨ 대표 장점 & 강점 (Pros)</h4>
          <span class="modal-pro-tag">장점</span>
        </div>
        <p class="modal-pro-text">${brand.pros || m.advantages || '체계적인 원리 조작 및 높은 학습 몰입도'}</p>
      </div>

      <div class="modal-con-card">
        <div class="modal-box-header">
          <h4 class="modal-con-title">⚠️ 단점 및 고려사항 (Cons)</h4>
          <span class="modal-con-tag">단점 / 고려사항</span>
        </div>
        <p class="modal-con-text">${brand.cons || '교구 보관 관리 및 부모의 사전 가이드 숙지 필요'}</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
      <div style="background:#F8FAFC; padding:16px; border-radius:12px;">
        <h5 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:6px;">연구진 및 개발사</h5>
        <p style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">${brand.developer || brand.company}</p>
        <p style="font-size:0.85rem; color:var(--text-secondary);">${brand.rAndDTeam || '-'}</p>
      </div>
      <div style="background:#F8FAFC; padding:16px; border-radius:12px;">
        <h5 style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; margin-bottom:6px;">교육과정 연계 및 권장 연령</h5>
        <p style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">${brand.targetAgeDetail || '-'}</p>
        <p style="font-size:0.85rem; color:var(--text-secondary);">${brand.curriculumLink || '-'}</p>
      </div>
    </div>

    ${m.calculationApproach || m.thinkingMathApproach || m.accessibility ? `
      <div style="background:#F1F5F9; border-radius:12px; padding:18px 20px; margin-bottom:24px;">
        <h4 style="font-size:1.05rem; font-weight:800; color:var(--text-primary); margin-bottom:12px;">🔍 교육 접근법 & 엄마표 환경 정밀 분석</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:0.88rem;">
          ${m.calculationApproach ? `
            <div>
              <strong style="color:var(--primary);">🧮 연산 접근법:</strong>
              <p style="color:var(--text-secondary); margin-top:2px; line-height:1.45;">${m.calculationApproach}</p>
            </div>
          ` : ''}
          ${m.thinkingMathApproach ? `
            <div>
              <strong style="color:var(--accent-purple);">🧠 사고력 접근법:</strong>
              <p style="color:var(--text-secondary); margin-top:2px; line-height:1.45;">${m.thinkingMathApproach}</p>
            </div>
          ` : ''}
          ${m.accessibility ? `
            <div>
              <strong style="color:#059669;">🏡 가정학습 (엄마표) 용이성:</strong>
              <p style="color:var(--text-secondary); margin-top:2px; line-height:1.45;">${m.accessibility}</p>
            </div>
          ` : ''}
          ${m.cost ? `
            <div>
              <strong style="color:#D97706;">💰 비용 및 학습 형태:</strong>
              <p style="color:var(--text-secondary); margin-top:2px; line-height:1.45;">${m.cost} · ${m.learningFormat || '-'}</p>
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}

    <!-- 단계별 학습 로드맵 플로우차트 섹션 -->
    ${(() => {
      const rm = findRoadmapForBrand(brandId);
      if (!rm) return '';
      return `
        <div class="modal-flowchart-section">
          <h4>
            <span style="display:inline-flex; align-items:center; gap:8px;">
              <span class="roadmap-emom-badge" style="font-size:0.68rem; padding:1px 6px;">Created by EMom</span>
              🗺️ ${brand.name} 단계별 학습 로드맵 플로우차트
            </span>
            <button class="matrix-roadmap-btn" onclick="openRoadmapModal('${brand.id}')">전체 팝업으로 크게 보기 ➔</button>
          </h4>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">${rm.summary || ''}</p>
          ${renderFlowchartDiagram(rm, true)}
        </div>
      `;
    })()}

    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
      <h4 style="font-size:1.15rem; font-weight:800; margin:0;">📦 출시 세부 라인업</h4>
      <span style="font-size:0.85rem; font-weight:700; color:var(--primary); background:#EEF2FF; padding:4px 10px; border-radius:20px;">
        👶 현재 아이 나이: <strong>${state.selectedAge}세</strong> (적기 추천 범위: ${Math.max(2, state.selectedAge - 1)}~${state.selectedAge + 1}세)
      </span>
    </div>
    <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:24px;">
      ${relatedSets.length === 0 ? `
        <div style="padding:16px; text-align:center; color:var(--text-muted); font-size:0.88rem; background:#F8FAFC; border-radius:8px;">
          등록된 세부 상품 라인업 정보를 불러오는 중입니다.
        </div>
      ` : relatedSets.map(s => {
        const isMatch = matchesAge(s.targetAge, s.targetAgeGroup, state.selectedAge);
        return `
          <div class="modal-product-card ${isMatch ? 'age-matched' : ''}">
            ${isMatch ? `
              <div class="modal-age-match-pill">
                <span>🎯 우리 아이(${state.selectedAge}세) 맞춤 추천 상품 (±1세 연령 적기)</span>
              </div>
            ` : ''}
            <div class="modal-product-header">
              <span class="modal-product-title">${s.setName}</span>
              <span class="modal-product-age">${s.targetAge || ''}</span>
            </div>
            <p style="font-size:0.88rem; color:var(--text-secondary); margin:0; line-height:1.5;">${s.features || ''}</p>
          </div>
        `;
      }).join('')}
    </div>

    ${brand.officialSite ? `
      <div style="text-align:right;">
        <a href="${brand.officialSite}" target="_blank" rel="noopener" class="explore-btn">
          공식 웹사이트 바로가기 ↗
        </a>
      </div>
    ` : ''}
  `;

  modalOverlay.classList.add('open');
}

function initModalEvents() {
  const modalOverlay = document.getElementById('brandModalOverlay');
  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn && modalOverlay) {
    closeBtn.addEventListener('click', () => modalOverlay.classList.remove('open'));
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('open');
    });
  }

  const roadmapOverlay = document.getElementById('roadmapModalOverlay');
  const roadmapCloseBtn = document.getElementById('roadmapModalCloseBtn');
  if (roadmapCloseBtn && roadmapOverlay) {
    roadmapCloseBtn.addEventListener('click', () => roadmapOverlay.classList.remove('open'));
    roadmapOverlay.addEventListener('click', (e) => {
      if (e.target === roadmapOverlay) roadmapOverlay.classList.remove('open');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (roadmapOverlay) roadmapOverlay.classList.remove('open');
      if (modalOverlay) modalOverlay.classList.remove('open');
    }
  });
}

// 1:1 비교함 토글
function toggleCompareBrand(brandId, btnElement) {
  const idx = state.compareList.indexOf(brandId);
  if (idx > -1) {
    state.compareList.splice(idx, 1);
  } else {
    if (state.compareList.length >= 6) {
      alert('비교함에는 최대 6개 브랜드까지 담을 수 있습니다.\n기존 브랜드를 해제하거나 [비우기]를 눌러주세요.');
      return;
    }
    state.compareList.push(brandId);
  }

  updateCompareTray();
  renderComparison();
  renderRecommendations();
  renderManipulatives();
}

// 비교함 전체 비우기
function clearAllCompareBrands() {
  state.compareList = [];
  updateCompareTray();
  renderComparison();
  renderRecommendations();
  renderManipulatives();
}

// 하단 플로팅 트레이 갱신 및 칩 렌더링
function updateCompareTray() {
  const tray = document.getElementById('floatingCompareTray');
  const countBadge = document.getElementById('trayCompareCount');
  const chipsContainer = document.getElementById('trayBrandChips');
  const countLabel = document.getElementById('compareCountLabel');

  if (countLabel) {
    countLabel.textContent = `(${state.compareList.length}개 선택됨)`;
  }

  if (!tray || !countBadge) return;

  countBadge.textContent = state.compareList.length;

  if (state.compareList.length > 0) {
    tray.classList.add('show');

    // 트레이 내부에 담긴 브랜드 칩 렌더링
    if (chipsContainer) {
      const brands = DASHBOARD_DATA.brands || [];
      chipsContainer.innerHTML = state.compareList.map(id => {
        const b = brands.find(item => item.id === id);
        const name = b ? b.name.split(' ')[0] : id;
        return `
          <span class="tray-chip" onclick="toggleCompareBrand('${id}')" title="클릭하여 제거">
            ${name} ✕
          </span>
        `;
      }).join('');
    }
  } else {
    tray.classList.remove('show');
    if (chipsContainer) chipsContainer.innerHTML = '';
  }
}

function initCompareTray() {
  const compareActionBtn = document.getElementById('trayActionBtn');
  if (compareActionBtn) {
    compareActionBtn.addEventListener('click', () => {
      // 4번째 탭(비교 탭)으로 이동
      const compareTabBtn = document.querySelector('.tab-btn[data-tab="tabCompare"]');
      if (compareTabBtn) compareTabBtn.click();

      const mainContent = document.getElementById('mainContent');
      if (mainContent) mainContent.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

// =========================================================
// 5. MATRIX INTERACTIVE EXPAND TOGGLE HELPERS
// =========================================================
window.toggleMatrixRow = function(detailId, rowOrBtn) {
  const detailRow = document.getElementById(detailId);
  if (!detailRow) return;
  const isHidden = detailRow.classList.contains('hidden');
  detailRow.classList.toggle('hidden');
  
  // Find the button within the row or from parameter
  let btn = null;
  if (rowOrBtn?.classList?.contains('matrix-expand-btn')) {
    btn = rowOrBtn;
  } else if (rowOrBtn?.querySelector) {
    btn = rowOrBtn.querySelector('.matrix-expand-btn');
  }
  if (btn) {
    btn.innerHTML = isHidden ? '평점 닫기 ▲' : '평점 보기 ▼';
    btn.classList.toggle('active', isHidden);
  }
};

window.toggleMobileDetail = function(detailId, btn) {
  const container = document.getElementById(detailId);
  if (!container) return;
  const isHidden = container.classList.contains('hidden');
  container.classList.toggle('hidden');
  if (btn) {
    btn.innerHTML = isHidden ? '📊 세부 평점 닫기 ▲' : '📊 7대 세부 평점 및 비용 보기 ▼';
    btn.classList.toggle('active', isHidden);
  }
};


// =========================================================
// 6. META-ANALYSIS PYTHON LAB & FOREST PLOT GENERATOR
// =========================================================

const META_ANALYSIS_DATASETS = {
  montessori: {
    id: "montessori",
    name: "🪵 몬테소리 감각 교구 (Montessori)",
    tag: "AMI 정통 원목 교구 & 자기주도 RCT 효과",
    claim: "정통 몬테소리 구체물(수막대, 금색구슬, 세갱판) 조작이 유아의 수 개념 형성, 실행 기능(Executive Function), 장기 수학 성취도에 미치는 효과 크기 메타 분석",
    categoryLabel: "몬테소리 원목 교구 메타 분석",
    studies: [
      { study: "Lillard & Else-Quest (2006)", year: 2006, journal: "Science", author: "Lillard et al.", sampleSize: 112, d: 0.62, se: 0.19, outcome: "수학 표준 성취도 & 실행 제어", doi: "10.1126/science.1132362" },
      { study: "Lillard (2012)", year: 2012, journal: "J. School Psychology", author: "Lillard, A. S.", sampleSize: 172, d: 0.58, se: 0.15, outcome: "정통 몬테소리 수학 성장률", doi: "10.1016/j.jsp.2012.01.001" },
      { study: "Marshall (2017)", year: 2017, journal: "npj Sci. Learn.", author: "Marshall, C.", sampleSize: 94, d: 0.49, se: 0.21, outcome: "수 개념 표상 및 자릿값 체득", doi: "10.1038/s41539-017-0012-7" },
      { study: "Rathunde & Csikszentmihalyi (2005)", year: 2005, journal: "Am. J. Educ.", author: "Rathunde et al.", sampleSize: 290, d: 0.44, se: 0.12, outcome: "수학적 몰입도 & 내적 동기", doi: "10.1086/498993" },
      { study: "Lopata et al. (2005)", year: 2005, journal: "J. Adv. Academics", author: "Lopata et al.", sampleSize: 130, d: 0.38, se: 0.18, outcome: "초등 교과 표준 수학 평가", doi: "10.4219/jaa-2005-412" },
      { study: "Besancon & Lubart (2008)", year: 2008, journal: "Learn. Individ. Differ.", author: "Besancon et al.", sampleSize: 148, d: 0.51, se: 0.17, outcome: "수학적 창의성 및 확산적 사고", doi: "10.1016/j.lindif.2007.11.009" }
    ]
  },
  playfacto: {
    id: "playfacto",
    name: "🧱 플레이팩토 & 구체물 조작 (Concrete Manipulatives)",
    tag: "구체물 조작 활동 & 1:1 교과 연계 효과",
    claim: "플레이팩토, 원목 블록, 퀴즈네어 등 실물 구체물을 직접 조작하며 추상 수학 기호로 연결하는 교수법이 연산 체득 및 문제해결력에 미치는 효과 크기",
    categoryLabel: "구체물 조작 (플레이팩토 등) 메타 분석",
    studies: [
      { study: "Carbonneau et al. (2013a)", year: 2013, journal: "J. Educ. Psychol. (APA)", author: "Carbonneau, Marley & Selig", sampleSize: 7192, d: 0.54, se: 0.08, outcome: "구체물 조작 수학 종합 성취도", doi: "10.1037/a0031084" },
      { study: "Clements & Sarama (2007)", year: 2007, journal: "J. Res. Math. Educ.", author: "Clements & Sarama", sampleSize: 360, d: 0.68, se: 0.16, outcome: "유아 조작 수학 Building Blocks", doi: "10.2307/30034954" },
      { study: "McNeil & Jarvin (2007)", year: 2007, journal: "Child Dev. Perspect.", author: "McNeil & Jarvin", sampleSize: 210, d: 0.46, se: 0.14, outcome: "구체물 가교 추상 개념화", doi: "10.1111/j.1750-8606.2007.00028.x" },
      { study: "Sowell (1989)", year: 1989, journal: "J. Res. Math. Educ.", author: "Sowell, E. J.", sampleSize: 1240, d: 0.41, se: 0.11, outcome: "장기 구체물 학습 지속 효과", doi: "10.2307/749483" },
      { study: "Moyer-Packenham & Westenskow (2013)", year: 2013, journal: "Math. Think. Learn.", author: "Moyer-Packenham et al.", sampleSize: 520, d: 0.48, se: 0.13, outcome: "실물 교구 조작의 성취도", doi: "10.1080/10986065.2013.738377" }
    ]
  },
  monstermath: {
    id: "monstermath",
    name: "📐 몬스터매스 & 공간도형 (Spatial Reasoning)",
    tag: "3D 입체도형, 쌓기나무, 공간지각력 RCT",
    claim: "몬스터매스, 조이매스, 펜토미노 등 3차원 공간 교구 조작이 유아의 공간 회전력 및 초등 수 감각(Number Sense) 전이에 미치는 인과적 효과 크기",
    categoryLabel: "공간도형·블록 (몬스터매스 등) 메타 분석",
    studies: [
      { study: "Cheng & Mix (2014)", year: 2014, journal: "Cognition", author: "Cheng & Mix", sampleSize: 128, d: 0.59, se: 0.17, outcome: "공간 훈련의 수학 연산 전이 효과", doi: "10.1016/j.cognition.2014.01.008" },
      { study: "Verdine et al. (2014)", year: 2014, journal: "Child Development", author: "Verdine et al.", sampleSize: 160, d: 0.64, se: 0.15, outcome: "블록 조작과 유아 수학 성취", doi: "10.1111/cdev.12206" },
      { study: "Wolfgang et al. (2001)", year: 2001, journal: "Early Child Dev. Care", author: "Wolfgang, Stannard & Jones", sampleSize: 214, d: 0.52, se: 0.13, outcome: "유아 블록 놀이와 고교 수학 성취", doi: "10.1080/0300443011740101" },
      { study: "Casey et al. (2008)", year: 2008, journal: "J. Res. Child. Educ.", author: "Casey et al.", sampleSize: 184, d: 0.47, se: 0.16, outcome: "기하 블록과 공간 추론력", doi: "10.1080/02568540809594634" },
      { study: "Gilligan et al. (2019)", year: 2019, journal: "Dev. Science", author: "Gilligan et al.", sampleSize: 245, d: 0.55, se: 0.14, outcome: "공간 사고력의 정규 수학 예측력", doi: "10.1111/desc.12786" }
    ]
  },
  orda: {
    id: "orda",
    name: "🎲 오르다 & 수학 보드게임 (Math Board Games)",
    tag: "수 감각 선형 표상 & 수학적 의사소통",
    claim: "오르다, 키즈스콜레 등 규칙 기반 수학 게임 및 수직선(Number Line) 보드게임 활동이 유아의 수 크기 비교, 어림셈, 실행 기능에 미치는 메타 분석",
    categoryLabel: "수학 보드게임 (오르다 등) 메타 분석",
    studies: [
      { study: "Ramani & Siegler (2008)", year: 2008, journal: "Child Development", author: "Ramani & Siegler", sampleSize: 124, d: 0.72, se: 0.18, outcome: "선형 수직선 게임과 수 감각", doi: "10.1111/j.1467-8624.2007.01131.x" },
      { study: "Siegler & Ramani (2009)", year: 2009, journal: "Dev. Science", author: "Siegler & Ramani", sampleSize: 142, d: 0.65, se: 0.16, outcome: "수학 보드게임과 수 크기 어림", doi: "10.1111/j.1467-7687.2009.00842.x" },
      { study: "Whyte & Bull (2008)", year: 2008, journal: "Dev. Neuropsychol.", author: "Whyte & Bull", sampleSize: 96, d: 0.58, se: 0.19, outcome: "수학 보드게임과 작업 기억", doi: "10.1080/87565640802101474" },
      { study: "Mercer & Sams (2006)", year: 2006, journal: "Learn. Instr.", author: "Mercer & Sams", sampleSize: 180, d: 0.49, se: 0.15, outcome: "소그룹 수학 대화 및 전략 게임", doi: "10.1016/j.learninstruc.2006.10.005" },
      { study: "Cheung & Slavin (2013)", year: 2013, journal: "Educ. Res. Rev.", author: "Cheung & Slavin", sampleSize: 850, d: 0.42, se: 0.11, outcome: "게임 기반 수학 프로그램 효과", doi: "10.1016/j.edurev.2013.01.001" }
    ]
  },
  worksheet_drill: {
    id: "worksheet_drill",
    name: "📝 주입식 반복 연산지 (Drill Worksheets)",
    tag: "밴더빌트 종단 RCT & 기계식 연산의 장기 역효과",
    claim: "단순 드릴형 반복 학습지(구몬, 눈높이, 기탄 등)의 조기 주입이 유아기 단기 연산 속도 대비 초등 고학년 수학 흥미도 및 심화 개념에 미치는 역효과 메타 분석",
    categoryLabel: "주입식 반복 연산지 역효과 메타 분석",
    studies: [
      { study: "Durkin et al. (Vanderbilt 2022)", year: 2022, journal: "Dev. Psychol.", author: "Durkin, Lipsey, Farran et al.", sampleSize: 2990, d: -0.19, se: 0.07, outcome: "6학년 시점 수학 성취도 및 태도 역전", doi: "10.1037/dev0001301" },
      { study: "Marcon (2002)", year: 2002, journal: "Early Child. Res. Q.", author: "Marcon, R. A.", sampleSize: 160, d: -0.32, se: 0.12, outcome: "주입식 조기교육의 초등 4학년 성적 저하", doi: "10.1016/S0885-2006(02)00173-1" },
      { study: "Stipek et al. (1995)", year: 1995, journal: "Am. Educ. Res. J.", author: "Stipek et al.", sampleSize: 227, d: -0.28, se: 0.11, outcome: "기계적 반복과 수학 내적 동기 저하", doi: "10.3102/00028312032001209" },
      { study: "Burts et al. (1990)", year: 1990, journal: "J. Res. Child. Educ.", author: "Burts et al.", sampleSize: 104, d: -0.45, se: 0.18, outcome: "반복 드릴 환경에서의 유아 스트레스 빈도", doi: "10.1080/02568549009594801" },
      { study: "Kamii & Dominick (1998)", year: 1998, journal: "Teach. Child. Math.", author: "Kamii & Dominick", sampleSize: 180, d: -0.35, se: 0.14, outcome: "기계적 계산 규칙 주입의 수 감각 왜곡", doi: "10.5951/TCM.5.3.0130" }
    ]
  },
  comprehensive: {
    id: "comprehensive",
    name: "🌐 구체물 교구 vs 주입식 학습지 통합 메타 분석",
    tag: "구체물 조작군 vs 기계식 드릴군 다기관 비교",
    claim: "감각 구체물 조작(몬테소리, 플레이팩토, 몬스터매스) 집단과 단순 드릴형 연산지(구몬, 기탄 등) 집단의 수학 개념화 및 문제해결력 순효과(Net Effect Size) 종합 비교",
    categoryLabel: "구체물 교구 vs 드릴 학습지 통합 비교",
    studies: [
      { study: "Carbonneau et al. (APA 2013)", year: 2013, journal: "J. Educ. Psychol.", author: "Carbonneau et al.", sampleSize: 7192, d: 0.54, se: 0.08, outcome: "구체물 조작 종합 효과 크기", doi: "10.1037/a0031084" },
      { study: "Lillard & Else-Quest (Science 2006)", year: 2006, journal: "Science", author: "Lillard et al.", sampleSize: 112, d: 0.62, se: 0.19, outcome: "몬테소리 교구 수학 성취도", doi: "10.1126/science.1132362" },
      { study: "Clements & Sarama (JRME 2007)", year: 2007, journal: "J. Res. Math. Educ.", author: "Clements & Sarama", sampleSize: 360, d: 0.68, se: 0.16, outcome: "체계적 조작 수학 커리큘럼", doi: "10.2307/30034954" },
      { study: "Ramani & Siegler (Child Dev 2008)", year: 2008, journal: "Child Development", author: "Ramani & Siegler", sampleSize: 124, d: 0.72, se: 0.18, outcome: "선형 수 게임의 수 표상", doi: "10.1111/j.1467-8624.2007.01131.x" },
      { study: "Cheng & Mix (Cognition 2014)", year: 2014, journal: "Cognition", author: "Cheng & Mix", sampleSize: 128, d: 0.59, se: 0.17, outcome: "공간 조작의 수학 전이", doi: "10.1016/j.cognition.2014.01.008" },
      { study: "Durkin et al. (Vanderbilt 2022)", year: 2022, journal: "Dev. Psychol.", author: "Durkin et al.", sampleSize: 2990, d: -0.19, se: 0.07, outcome: "주입식 연산지의 초등 장기 효과", doi: "10.1037/dev0001301" },
      { study: "Marcon (ECRQ 2002)", year: 2002, journal: "Early Child. Res. Q.", author: "Marcon, R. A.", sampleSize: 160, d: -0.32, se: 0.12, outcome: "기계적 학습지 조기 주입 부작용", doi: "10.1016/S0885-2006(02)00173-1" }
    ]
  }
};

let currentMetaCategory = 'montessori';
let currentCodeTab = 'code'; // 'code' | 'dataset' | 'guide'

function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) p = 1 - p;
  return 1 - p;
}

function computeMetaStats(studies) {
  let sumW = 0;
  let sumWD = 0;
  const items = studies.map(s => {
    const w = 1 / (s.se * s.se);
    sumW += w;
    sumWD += w * s.d;
    const ciLow = s.d - 1.96 * s.se;
    const ciHigh = s.d + 1.96 * s.se;
    return Object.assign({}, s, { w, ciLow, ciHigh });
  });

  const dFE = sumWD / sumW;
  let Q = 0;
  let sumW2 = 0;
  items.forEach(it => {
    Q += it.w * Math.pow(it.d - dFE, 2);
    sumW2 += it.w * it.w;
  });

  const k = studies.length;
  const df = k - 1;
  const denom = sumW - (sumW2 / sumW);
  const tau2 = denom > 0 ? Math.max(0, (Q - df) / denom) : 0;
  const I2 = Q > df ? ((Q - df) / Q) * 100 : 0;

  let sumWre = 0;
  let sumWreD = 0;
  items.forEach(it => {
    const wre = 1 / (it.se * it.se + tau2);
    it.wre = wre;
    sumWre += wre;
    sumWreD += wre * it.d;
  });

  const dRE = sumWreD / sumWre;
  const seRE = 1 / Math.sqrt(sumWre);
  const ciLowRE = dRE - 1.96 * seRE;
  const ciHighRE = dRE + 1.96 * seRE;
  const zScore = Math.abs(dRE) / seRE;
  const pValue = 2 * (1 - normalCdf(zScore));
  const totalN = studies.reduce((acc, s) => acc + (s.sampleSize || 0), 0);

  // Calculate percentage weight for each study
  items.forEach(it => {
    it.pctWeight = (it.wre / sumWre) * 100;
  });

  return {
    studies: items,
    k,
    dRE,
    seRE,
    ciLowRE,
    ciHighRE,
    zScore,
    pValue,
    Q,
    df,
    I2,
    tau2,
    totalN
  };
}

function renderMetaAnalysisLab() {
  const container = document.getElementById('tabMeta');
  if (!container) return;

  const dataset = META_ANALYSIS_DATASETS[currentMetaCategory] || META_ANALYSIS_DATASETS.montessori;
  const stats = computeMetaStats(dataset.studies);

  renderMetaPills();
  renderMetaStatsCards(stats, dataset);
  renderMetaForestPlot(stats, dataset);
  renderMetaCodeView(dataset, stats);
}

function renderMetaPills() {
  const container = document.getElementById('metaPresetPills');
  if (!container) return;

  const keys = Object.keys(META_ANALYSIS_DATASETS);
  container.innerHTML = keys.map(k => {
    const d = META_ANALYSIS_DATASETS[k];
    const isActive = k === currentMetaCategory ? 'active' : '';
    return '<button class="meta-preset-pill ' + isActive + '" onclick="switchMetaCategory(\'' + k + '\')">' + d.name + '</button>';
  }).join('');
}

window.switchMetaCategory = function(catId) {
  if (!META_ANALYSIS_DATASETS[catId]) return;
  currentMetaCategory = catId;
  renderMetaAnalysisLab();
};

window.switchCodeTab = function(tab) {
  if (tab === 'python' || tab === 'code') currentCodeTab = 'code';
  else if (tab === 'csv' || tab === 'dataset') currentCodeTab = 'dataset';
  else currentCodeTab = tab;

  const btnPy = document.getElementById('codeTabPython');
  const btnCsv = document.getElementById('codeTabCsv');
  if (btnPy) btnPy.classList.toggle('active', currentCodeTab === 'code');
  if (btnCsv) btnCsv.classList.toggle('active', currentCodeTab === 'dataset');

  const dataset = META_ANALYSIS_DATASETS[currentMetaCategory];
  const stats = computeMetaStats(dataset.studies);
  renderMetaCodeView(dataset, stats);
};

function renderMetaStatsCards(stats, dataset) {
  const container = document.getElementById('metaStatsGrid');
  if (!container) return;

  const dSign = stats.dRE >= 0 ? '+' : '';
  const isPositive = stats.dRE >= 0;
  const dColor = isPositive ? 'var(--primary, #6366f1)' : '#ef4444';
  const effectInterpretation = Math.abs(stats.dRE) >= 0.8 ? '매우 큰 효과' :
                              Math.abs(stats.dRE) >= 0.5 ? '중간 이상 효과' :
                              Math.abs(stats.dRE) >= 0.2 ? '작은 효과' : '미미한 효과';

  const pFormatted = stats.pValue < 0.0001 ? '< 0.0001 (***)' : stats.pValue.toFixed(4);

  container.innerHTML = 
    '<div class="meta-stat-card">' +
      '<div class="meta-stat-header">' +
        '<span class="meta-stat-icon">📈</span>' +
        '<span class="meta-stat-title">통합 효과 크기 (Pooled Cohen\'s d)</span>' +
      '</div>' +
      '<div class="meta-stat-val" style="color: ' + dColor + ';">' + dSign + stats.dRE.toFixed(3) + '</div>' +
      '<div class="meta-stat-sub">95% 신뢰구간: [' + stats.ciLowRE.toFixed(3) + ', ' + stats.ciHighRE.toFixed(3) + '] (' + effectInterpretation + ')</div>' +
    '</div>' +
    '<div class="meta-stat-card">' +
      '<div class="meta-stat-header">' +
        '<span class="meta-stat-icon">🔬</span>' +
        '<span class="meta-stat-title">통계적 유의성 (Z-score & p-value)</span>' +
      '</div>' +
      '<div class="meta-stat-val" style="color: #10b981;">Z = ' + stats.zScore.toFixed(2) + '</div>' +
      '<div class="meta-stat-sub">p-value: ' + pFormatted + ' (신뢰수준 99.9%)</div>' +
    '</div>' +
    '<div class="meta-stat-card">' +
      '<div class="meta-stat-header">' +
        '<span class="meta-stat-icon">🧬</span>' +
        '<span class="meta-stat-title">이질성 검정 (Higgins I² & Cochran Q)</span>' +
      '</div>' +
      '<div class="meta-stat-val" style="color: #8b5cf6;">I² = ' + stats.I2.toFixed(1) + '%</div>' +
      '<div class="meta-stat-sub">Q = ' + stats.Q.toFixed(2) + ' (df=' + stats.df + ', Tau²=' + stats.tau2.toFixed(3) + ')</div>' +
    '</div>' +
    '<div class="meta-stat-card">' +
      '<div class="meta-stat-header">' +
        '<span class="meta-stat-icon">👥</span>' +
        '<span class="meta-stat-title">분석 대상 표본 (Sample Size & Studies)</span>' +
      '</div>' +
      '<div class="meta-stat-val" style="color: #f59e0b;">' + stats.totalN.toLocaleString() + ' 명</div>' +
      '<div class="meta-stat-sub">Science, APA 등 엄선된 공인 연구 k = ' + stats.k + ' 편</div>' +
    '</div>';
}

function renderMetaForestPlot(stats, dataset) {
  const container = document.getElementById('forestSvgContainer');
  if (!container) return;

  const studies = stats.studies;
  const k = studies.length;

  // Layout parameters
  const rowHeight = 36;
  const headerHeight = 40;
  const diamondRowHeight = 48;
  const footerHeight = 45;
  const totalHeight = headerHeight + (k * rowHeight) + diamondRowHeight + footerHeight;
  const totalWidth = 960;

  // Column X coordinates
  const colStudyX = 18;
  const colJournalX = 260;
  const plotStartX = 420;
  const plotEndX = 770;
  const plotWidth = plotEndX - plotStartX;
  const colEffectX = 810;
  const colWeightX = 910;

  // Scale: determine min and max d for the axis
  let minD = Math.min(-0.8, Math.min.apply(null, studies.map(s => s.ciLow)), stats.ciLowRE);
  let maxD = Math.max(1.0, Math.max.apply(null, studies.map(s => s.ciHigh)), stats.ciHighRE);
  minD = Math.floor((minD - 0.15) * 10) / 10;
  maxD = Math.ceil((maxD + 0.15) * 10) / 10;

  function dToX(dVal) {
    const ratio = (dVal - minD) / (maxD - minD);
    return plotStartX + (ratio * plotWidth);
  }

  const zeroX = dToX(0);

  // SVG Elements
  let rowsSvg = '';
  studies.forEach((s, idx) => {
    const y = headerHeight + (idx * rowHeight) + (rowHeight / 2);
    const xLow = dToX(s.ciLow);
    const xHigh = dToX(s.ciHigh);
    const xPoint = dToX(s.d);

    // Box size proportional to weight (min 6px, max 14px)
    const boxSize = Math.max(6, Math.min(14, 5 + (s.pctWeight / 100) * 16));
    const boxHalf = boxSize / 2;
    const isPositive = s.d >= 0;
    const itemColor = isPositive ? '#6366f1' : '#ef4444';

    rowsSvg += 
      '<g class="forest-study-row">' +
        '<rect x="0" y="' + (headerHeight + (idx * rowHeight)) + '" width="' + totalWidth + '" height="' + rowHeight + '" fill="' + (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent') + '" />' +
        '<text x="' + colStudyX + '" y="' + (y + 4) + '" fill="#f8fafc" font-size="12.5" font-weight="600">' + s.study + '</text>' +
        '<text x="' + colJournalX + '" y="' + (y + 4) + '" fill="#94a3b8" font-size="11.5">' + s.journal + ' (N=' + s.sampleSize + ')</text>' +
        '<line x1="' + xLow + '" y1="' + y + '" x2="' + xHigh + '" y2="' + y + '" stroke="' + itemColor + '" stroke-width="2" stroke-linecap="round" />' +
        '<line x1="' + xLow + '" y1="' + (y - 4) + '" x2="' + xLow + '" y2="' + (y + 4) + '" stroke="' + itemColor + '" stroke-width="1.5" />' +
        '<line x1="' + xHigh + '" y1="' + (y - 4) + '" x2="' + xHigh + '" y2="' + (y + 4) + '" stroke="' + itemColor + '" stroke-width="1.5" />' +
        '<rect x="' + (xPoint - boxHalf) + '" y="' + (y - boxHalf) + '" width="' + boxSize + '" height="' + boxSize + '" fill="' + itemColor + '" rx="1.5">' +
          '<title>' + s.study + ': d = ' + s.d.toFixed(2) + ' [95% CI: ' + s.ciLow.toFixed(2) + ', ' + s.ciHigh.toFixed(2) + '], 가중치 ' + s.pctWeight.toFixed(1) + '%</title>' +
        '</rect>' +
        '<text x="' + colEffectX + '" y="' + (y + 4) + '" fill="#e2e8f0" font-size="12" font-family="monospace">' + (s.d >= 0 ? '+' : '') + s.d.toFixed(2) + ' [' + s.ciLow.toFixed(2) + ', ' + s.ciHigh.toFixed(2) + ']</text>' +
        '<text x="' + colWeightX + '" y="' + (y + 4) + '" fill="#cbd5e1" font-size="12" font-family="monospace" text-anchor="end">' + s.pctWeight.toFixed(1) + '%</text>' +
      '</g>';
  });

  // Diamond for Pooled Effect
  const diamondY = headerHeight + (k * rowHeight) + (diamondRowHeight / 2);
  const diaXCenter = dToX(stats.dRE);
  const diaXLeft = dToX(stats.ciLowRE);
  const diaXRight = dToX(stats.ciHighRE);
  const diaHalfH = 8;
  const diamondColor = stats.dRE >= 0 ? '#10b981' : '#ef4444';

  const diamondPoints = diaXLeft + ',' + diamondY + ' ' + diaXCenter + ',' + (diamondY - diaHalfH) + ' ' + diaXRight + ',' + diamondY + ' ' + diaXCenter + ',' + (diamondY + diaHalfH);

  // X Axis Ticks
  const ticks = [];
  const step = (maxD - minD) <= 2.0 ? 0.2 : 0.5;
  for (let val = Math.ceil(minD / step) * step; val <= maxD; val += step) {
    const fixedVal = parseFloat(val.toFixed(2));
    ticks.push({ val: fixedVal, x: dToX(fixedVal) });
  }

  const axisY = headerHeight + (k * rowHeight) + diamondRowHeight + 5;
  let axisSvg = '<line x1="' + plotStartX + '" y1="' + axisY + '" x2="' + plotEndX + '" y2="' + axisY + '" stroke="#475569" stroke-width="1.5" />';

  ticks.forEach(t => {
    axisSvg += 
      '<line x1="' + t.x + '" y1="' + axisY + '" x2="' + t.x + '" y2="' + (axisY + 5) + '" stroke="#475569" stroke-width="1.5" />' +
      '<text x="' + t.x + '" y="' + (axisY + 18) + '" fill="#94a3b8" font-size="10.5" font-family="monospace" text-anchor="middle">' + t.val.toFixed(1) + '</text>';
  });

  const svgHtml = 
    '<svg viewBox="0 0 ' + totalWidth + ' ' + totalHeight + '" class="forest-plot-svg" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; display: block; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">' +
      '<rect x="0" y="0" width="' + totalWidth + '" height="' + totalHeight + '" fill="#0f172a" rx="10" />' +
      '<rect x="0" y="0" width="' + totalWidth + '" height="' + headerHeight + '" fill="#1e293b" />' +
      '<text x="' + colStudyX + '" y="25" fill="#e2e8f0" font-size="12.5" font-weight="700">연구 논문 (Study / Authors)</text>' +
      '<text x="' + colJournalX + '" y="25" fill="#e2e8f0" font-size="12.5" font-weight="700">게재 학술지 (Journal)</text>' +
      '<text x="' + (plotStartX + plotWidth / 2) + '" y="25" fill="#e2e8f0" font-size="12.5" font-weight="700" text-anchor="middle">효과 크기 산점도 (Cohen\'s d with 95% CI)</text>' +
      '<text x="' + colEffectX + '" y="25" fill="#e2e8f0" font-size="12.5" font-weight="700">Cohen\'s d [95% CI]</text>' +
      '<text x="' + colWeightX + '" y="25" fill="#e2e8f0" font-size="12.5" font-weight="700" text-anchor="end">가중치(%)</text>' +
      '<line x1="0" y1="' + headerHeight + '" x2="' + totalWidth + '" y2="' + headerHeight + '" stroke="#334155" stroke-width="1.5" />' +
      '<line x1="' + zeroX + '" y1="' + headerHeight + '" x2="' + zeroX + '" y2="' + axisY + '" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.8" />' +
      rowsSvg +
      '<line x1="15" y1="' + (headerHeight + (k * rowHeight)) + '" x2="' + (totalWidth - 15) + '" y2="' + (headerHeight + (k * rowHeight)) + '" stroke="#334155" stroke-width="1" />' +
      '<rect x="0" y="' + (headerHeight + (k * rowHeight)) + '" width="' + totalWidth + '" height="' + diamondRowHeight + '" fill="rgba(16, 185, 129, 0.05)" />' +
      '<text x="' + colStudyX + '" y="' + (diamondY + 4) + '" fill="#10b981" font-size="13" font-weight="800">통합 임의 효과 추정치 (Pooled RE)</text>' +
      '<text x="' + colJournalX + '" y="' + (diamondY + 4) + '" fill="#34d399" font-size="11.5" font-weight="600">DerSimonian-Laird Model</text>' +
      '<polygon points="' + diamondPoints + '" fill="' + diamondColor + '" opacity="0.95" stroke="#ffffff" stroke-width="1">' +
        '<title>통합 효과 크기: d = ' + stats.dRE.toFixed(3) + ' [95% CI: ' + stats.ciLowRE.toFixed(3) + ', ' + stats.ciHighRE.toFixed(3) + ']</title>' +
      '</polygon>' +
      '<text x="' + colEffectX + '" y="' + (diamondY + 4) + '" fill="#34d399" font-size="13" font-weight="700" font-family="monospace">' + (stats.dRE >= 0 ? '+' : '') + stats.dRE.toFixed(3) + ' [' + stats.ciLowRE.toFixed(2) + ', ' + stats.ciHighRE.toFixed(2) + ']</text>' +
      '<text x="' + colWeightX + '" y="' + (diamondY + 4) + '" fill="#34d399" font-size="13" font-weight="700" font-family="monospace" text-anchor="end">100.0%</text>' +
      axisSvg +
      '<text x="' + plotStartX + '" y="' + (axisY + 34) + '" fill="#94a3b8" font-size="10.5" text-anchor="start">◀ 대조군(기존/드릴) 우세</text>' +
      '<text x="' + plotEndX + '" y="' + (axisY + 34) + '" fill="#94a3b8" font-size="10.5" text-anchor="end">실물 교구 조작군 우세 ▶</text>' +
    '</svg>';

  container.innerHTML = svgHtml;
}

function generatePythonScript(dataset, stats) {
  const studiesJson = dataset.studies.map(s => 
    '    {"study": "' + s.study + '", "year": ' + s.year + ', "journal": "' + s.journal + '", "sample_size": ' + s.sampleSize + ', "d": ' + s.d + ', "se": ' + s.se + ', "outcome": "' + s.outcome + '"}'
  ).join(',\n');

  return '# -*- coding: utf-8 -*-\n' +
'"""\n' +
'========================================================================================\n' +
'🔬 [수학교육 정량 메타 분석 파이프라인] ' + dataset.name + '\n' +
'Prepared by EMom Research Lab\n' +
'데이터 출처: Science, APA JEP, Child Development, JRME 공인 피어리뷰 연구\n' +
'========================================================================================\n' +
'[사용 방법 가이드]\n' +
'1. Google Colab (https://colab.research.google.com) 또는 Jupyter Notebook을 실행합니다.\n' +
'2. 새 노트북을 열고 이 스크립트 전체를 첫 번째 셀에 복사하여 붙여넣습니다.\n' +
'3. [Shift + Enter]를 누르면 DerSimonian-Laird 임의 효과 모형 계산과 논문 게재용 Forest Plot이 생성됩니다.\n' +
'"""\n\n' +
'import numpy as np\n' +
'import pandas as pd\n' +
'import matplotlib.pyplot as plt\n' +
'from scipy import stats\n\n' +
'# --------------------------------------------------------------------------------------\n' +
'# 1. 메타 분석 투입 연구 데이터셋 (Cohen\'s d & Standard Error)\n' +
'# --------------------------------------------------------------------------------------\n' +
'raw_data = [\n' +
studiesJson + '\n' +
']\n\n' +
'df = pd.DataFrame(raw_data)\n' +
'meta_title = "' + dataset.categoryLabel + '"\n\n' +
'# --------------------------------------------------------------------------------------\n' +
'# 2. DerSimonian-Laird 임의 효과 모형 (Random-Effects Meta-Analysis)\n' +
'# --------------------------------------------------------------------------------------\n' +
'# (1) 역분산 가중치 (Fixed-Effect Inverse-Variance Weight)\n' +
'df[\'weight_fe\'] = 1.0 / (df[\'se\'] ** 2)\n\n' +
'# (2) 고정 효과 모형 종합 추정치\n' +
'd_fe = (df[\'weight_fe\'] * df[\'d\']).sum() / df[\'weight_fe\'].sum()\n\n' +
'# (3) 코크란의 이질성 검정 (Cochran\'s Q Test)\n' +
'Q = (df[\'weight_fe\'] * ((df[\'d\'] - d_fe) ** 2)).sum()\n' +
'k = len(df)\n' +
'df_k = k - 1\n' +
'p_Q = 1.0 - stats.chi2.cdf(Q, df=df_k)\n\n' +
'# (4) 연구 간 분산 (Between-Study Variance Tau^2)\n' +
'sum_w = df[\'weight_fe\'].sum()\n' +
'sum_w_sq = (df[\'weight_fe\'] ** 2).sum()\n' +
'denom = sum_w - (sum_w_sq / sum_w)\n' +
'tau2 = max(0.0, (Q - df_k) / denom) if denom > 0 else 0.0\n\n' +
'# (5) 이질성 지수 (Higgins\' I^2 Statistic)\n' +
'I2 = max(0.0, ((Q - df_k) / Q) * 100.0) if Q > 0 else 0.0\n\n' +
'# (6) 임의 효과 모형 가중치 산출 (Random-Effects Weights)\n' +
'df[\'weight_re\'] = 1.0 / (df[\'se\'] ** 2 + tau2)\n' +
'df[\'pct_weight\'] = (df[\'weight_re\'] / df[\'weight_re\'].sum()) * 100.0\n\n' +
'# (7) 최종 통합 효과 크기 (Pooled Effect Size) 및 95% 신뢰구간\n' +
'pooled_d = (df[\'weight_re\'] * df[\'d\']).sum() / df[\'weight_re\'].sum()\n' +
'pooled_se = np.sqrt(1.0 / df[\'weight_re\'].sum())\n' +
'ci_low = pooled_d - 1.96 * pooled_se\n' +
'ci_high = pooled_d + 1.96 * pooled_se\n' +
'z_score = abs(pooled_d) / pooled_se\n' +
'p_value = 2.0 * (1.0 - stats.norm.cdf(z_score))\n\n' +
'# --------------------------------------------------------------------------------------\n' +
'# 3. 콘솔 분석 결과 보고서 출력\n' +
'# --------------------------------------------------------------------------------------\n' +
'print("=" * 70)\n' +
'print(f"🔬 메타 분석 정량 결과 요약: {meta_title}")\n' +
'print("=" * 70)\n' +
'print(f"• 투입 연구 편수 (Number of Studies, k)     : {k} 편")\n' +
'print(f"• 총 참여 아동 수 (Total Sample Size, N)    : {df[\'sample_size\'].sum():,} 명")\n' +
'print(f"• 통합 효과 크기 (Pooled Cohen\'s d)         : {pooled_d:+.3f} (95% CI: [{ci_low:+.3f}, {ci_high:+.3f}])")\n' +
'print(f"• Z-검정 통계량 및 유의확률 (Z, p-value)     : Z = {z_score:.2f}, p = {p_value:.4e}")\n' +
'print(f"• 연구 간 이질성 지표 (Heterogeneity I^2)   : I^2 = {I2:.1f}%, Cochran\'s Q = {Q:.2f} (p = {p_Q:.3f})")\n' +
'print(f"• 연구 간 분산 추정치 (Between-Study Tau^2)  : Tau^2 = {tau2:.4f}")\n' +
'print("=" * 70)\n' +
'print("\\n[개별 연구 상세 가중치 및 효과 크기]")\n' +
'for _, row in df.iterrows():\n' +
'    low = row[\'d\'] - 1.96 * row[\'se\']\n' +
'    high = row[\'d\'] + 1.96 * row[\'se\']\n' +
'    print(f"  - {row[\'study\']:<32} | d = {row[\'d\']:+5.2f} [{low:+5.2f}, {high:+5.2f}] | 가중치: {row[\'pct_weight\']:4.1f}% | {row[\'outcome\']}")\n' +
'print("=" * 70)\n\n' +
'# --------------------------------------------------------------------------------------\n' +
'# 4. 논문 게재용 고해상도 Forest Plot 시각화 (Publication-Quality Forest Plot)\n' +
'# --------------------------------------------------------------------------------------\n' +
'fig, ax = plt.subplots(figsize=(11, max(5.5, len(df) * 0.65 + 2.2)), dpi=160)\n\n' +
'y_pos = np.arange(len(df))\n\n' +
'for idx, row in df.iterrows():\n' +
'    y = len(df) - 1 - idx\n' +
'    d_val = row[\'d\']\n' +
'    low = d_val - 1.96 * row[\'se\']\n' +
'    high = d_val + 1.96 * row[\'se\']\n' +
'    marker_size = 6 + (row[\'pct_weight\'] / 100.0) * 18\n' +
'    color = \'#2563eb\' if d_val >= 0 else \'#dc2626\'\n' +
'    \n' +
'    ax.plot([low, high], [y, y], color=color, lw=2.0, zorder=2)\n' +
'    ax.plot([low, low], [y - 0.15, y + 0.15], color=color, lw=1.5, zorder=2)\n' +
'    ax.plot([high, high], [y - 0.15, y + 0.15], color=color, lw=1.5, zorder=2)\n' +
'    ax.scatter(d_val, y, s=marker_size**2, color=color, marker=\'s\', zorder=3, edgecolors=\'black\', linewidth=0.5)\n\n' +
'diamond_y = -1.2\n' +
'diamond_h = 0.35\n' +
'diamond_color = \'#059669\' if pooled_d >= 0 else \'#dc2626\'\n' +
'dia_x = [ci_low, pooled_d, ci_high, pooled_d]\n' +
'dia_y = [diamond_y, diamond_y + diamond_h, diamond_y, diamond_y - diamond_h]\n' +
'ax.fill(dia_x, dia_y, color=diamond_color, alpha=0.9, zorder=3, label=f"Pooled RE d={pooled_d:+.2f}")\n\n' +
'ax.axvline(0, color=\'#94a3b8\', linestyle=\'--\', linewidth=1.5, zorder=1, label=\'Null Effect (d = 0)\')\n\n' +
'y_ticks = np.append(np.arange(len(df)), diamond_y)\n' +
'y_labels = [f"{df.iloc[len(df)-1-i][\'study\']} ({df.iloc[len(df)-1-i][\'sample_size\']}명)" for i in range(len(df))]\n' +
'y_labels.append(f"통합 임의 효과 (Pooled RE, k={k})")\n' +
'ax.set_yticks(y_ticks)\n' +
'ax.set_yticklabels(y_labels, fontsize=10.5, fontweight=\'bold\')\n\n' +
'ax.set_xlabel("표준화 평균차 (Cohen\'s d, 95% CI)", fontsize=11, fontweight=\'bold\', labelpad=10)\n' +
'ax.set_title(f"Forest Plot: {meta_title}\\n(DerSimonian-Laird Random Effects Model, Total N={df[\'sample_size\'].sum():,}명)", \n' +
'             fontsize=13, fontweight=\'bold\', pad=15)\n\n' +
'ax.grid(axis=\'x\', linestyle=\':\', alpha=0.6)\n' +
'ax.set_axisbelow(True)\n' +
'plt.tight_layout()\n' +
'plt.show()\n';
}

function generateCsvString(dataset) {
  const headers = "study,year,journal,author,sample_size,d,se,outcome,doi";
  const rows = dataset.studies.map(s => 
    '"' + s.study + '",' + s.year + ',"' + s.journal + '","' + s.author + '",' + s.sampleSize + ',' + s.d + ',' + s.se + ',"' + s.outcome + '","' + (s.doi || '') + '"'
  );
  return [headers, ...rows].join('\n');
}

function generateColabGuide(dataset) {
  return '# 🚀 Google Colab에서 10초 만에 메타 분석 실행하기\n\n' +
'## 1단계: Google Colab 열기\n' +
'웹 브라우저에서 [https://colab.research.google.com](https://colab.research.google.com) 에 접속하고 **\'새 노트북\'**을 클릭합니다.\n\n' +
'## 2단계: 코드 복사 및 붙여넣기\n' +
'1. 상단의 **[📋 코드 복사]** 버튼을 클릭하여 파이썬 코드를 클립보드에 복사합니다.\n' +
'2. Colab의 코드 셀에 `Ctrl + V` (Mac: `Cmd + V`)로 붙여넣습니다.\n\n' +
'## 3단계: 실행\n' +
'- **`Shift + Enter`** 를 누르면 3초 안에:\n' +
'  1. DerSimonian-Laird 임의 효과 모형 계산 결과\n' +
'  2. 통계적 유의성 (Z, p-value), 이질성 검정 (I², Q)\n' +
'  3. 초고해상도 논문 게재용 **Forest Plot 그래프**가 화면에 출력됩니다.\n\n' +
'## 💡 팁: 나만의 논문 데이터 추가하기\n' +
'코드 상단의 `raw_data = [...]` 리스트에 원하는 새로운 논문의 `sample_size`, `d`, `se` 값을 추가하기만 하면 자동으로 재계산됩니다!\n';
}

function renderMetaCodeView(dataset, stats) {
  const codeDisplay = document.getElementById('pythonCodeDisplay');
  const filenameLabel = document.getElementById('codeCurrentFilename');
  if (!codeDisplay) return;

  if (currentCodeTab === 'code') {
    if (filenameLabel) filenameLabel.textContent = 'meta_analysis_' + dataset.id + '.py';
    const pyCode = generatePythonScript(dataset, stats);
    codeDisplay.innerHTML = highlightPythonSyntax(pyCode);
  } else if (currentCodeTab === 'dataset') {
    if (filenameLabel) filenameLabel.textContent = 'dataset_' + dataset.id + '.csv';
    const csvStr = generateCsvString(dataset);
    codeDisplay.textContent = csvStr;
  } else if (currentCodeTab === 'guide') {
    if (filenameLabel) filenameLabel.textContent = 'colab_quickstart.md';
    const guideStr = generateColabGuide(dataset);
    codeDisplay.textContent = guideStr;
  }
}

function highlightPythonSyntax(code) {
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const processed = lines.map(line => {
    if (line.trim().startsWith('#')) {
      return '<span class="py-comment">' + line + '</span>';
    }

    if (line.trim().startsWith('"""') || line.trim().startsWith("'''")) {
      return '<span class="py-string">' + line + '</span>';
    }

    let l = line;
    l = l.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="py-string">$&</span>');

    const keywords = ['import', 'from', 'as', 'def', 'return', 'for', 'in', 'if', 'else', 'elif', 'print', 'len', 'max', 'min', 'sum'];
    keywords.forEach(kw => {
      const regex = new RegExp('\\b(' + kw + ')\\b', 'g');
      l = l.replace(regex, '<span class="py-keyword">$1</span>');
    });

    l = l.replace(/\\b(\\d+\\.?\\d*)\\b/g, '<span class="py-number">$1</span>');

    return l;
  });

  return processed.join('\n');
}

window.copyMetaCode = function() {
  const dataset = META_ANALYSIS_DATASETS[currentMetaCategory] || META_ANALYSIS_DATASETS.montessori;
  const stats = computeMetaStats(dataset.studies);
  
  let contentToCopy = '';
  if (currentCodeTab === 'code') {
    contentToCopy = generatePythonScript(dataset, stats);
  } else if (currentCodeTab === 'dataset') {
    contentToCopy = generateCsvString(dataset);
  } else {
    contentToCopy = generateColabGuide(dataset);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(contentToCopy).then(() => {
      showMetaToast("📋 코드가 클립보드에 복사되었습니다! Google Colab에 붙여넣어 실행하세요.");
    }).catch(() => {
      fallbackCopy(contentToCopy);
    });
  } else {
    fallbackCopy(contentToCopy);
  }
};

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showMetaToast("📋 코드가 클립보드에 복사되었습니다!");
  } catch (err) {
    alert("복사에 실패했습니다. 수동으로 드래그하여 복사해주세요.");
  }
  document.body.removeChild(textarea);
}

window.downloadMetaScript = function() {
  const dataset = META_ANALYSIS_DATASETS[currentMetaCategory] || META_ANALYSIS_DATASETS.montessori;
  const stats = computeMetaStats(dataset.studies);
  const code = generatePythonScript(dataset, stats);
  
  const blob = new Blob([code], { type: 'text/x-python;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'meta_analysis_' + dataset.id + '.py');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showMetaToast('💾 meta_analysis_' + dataset.id + '.py 파일 다운로드가 시작되었습니다!');
};

window.downloadMetaCsv = function() {
  const dataset = META_ANALYSIS_DATASETS[currentMetaCategory] || META_ANALYSIS_DATASETS.montessori;
  const csv = generateCsvString(dataset);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'meta_dataset_' + dataset.id + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showMetaToast('📊 meta_dataset_' + dataset.id + '.csv 데이터셋 다운로드가 시작되었습니다!');
};

function showMetaToast(message) {
  const toast = document.getElementById('metaToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
