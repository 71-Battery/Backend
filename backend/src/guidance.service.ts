export class GuidanceService {
  async getGuidance(dto: { topic?: string; grade?: string; department?: string }) {
    const topic = (dto?.topic || '').trim().toLowerCase();
    const grade = dto?.grade || 'unknown';
    const department = dto?.department || 'unknown';

    if (!topic) {
      return {
        status: 'error',
        message: '주제를 입력해 주세요.',
      };
    }

    const normalized = topic.replace(/\s+/g, '');

    if (normalized.includes('인턴') || normalized.includes('intern')) {
      return {
        status: 'success',
        category: 'internship',
        title: '인턴십 준비',
        answer: `${grade} ${department} 학생이라면, 인턴십 준비는 자기소개서와 포트폴리오 정리부터 시작하는 것이 좋습니다. 지원 공고를 확인하고 관련 프로젝트 경험을 정리해 두세요.`,
      };
    }

    if (normalized.includes('규정') || normalized.includes('regulation')) {
      return {
        status: 'success',
        category: 'regulation',
        title: '규정 확인',
        answer: `${grade} ${department} 학생 기준으로, 규정 확인은 학교 공지사항과 학사 일정표를 우선 확인하는 것이 가장 안전합니다. 모르는 항목은 담당 부서에 문의해 주세요.`,
      };
    }

    if (normalized.includes('일정') || normalized.includes('schedule')) {
      return {
        status: 'success',
        category: 'schedule',
        title: '학사 일정',
        answer: `${grade} ${department} 학생에게는 학사 일정을 캘린더로 관리하는 것이 효과적입니다. 제출 마감일과 시험 일정을 미리 기록해 두세요.`,
      };
    }

    return {
      status: 'success',
      category: 'general',
      title: '지원 가이드',
      answer: `${grade} ${department} 학생에게 맞는 지원 계획을 세우기 위해, 인턴십·규정·일정 중 하나를 선택해 주세요.`,
    };
  }
}
