import { StorageService } from './storage.service';

export class ChatService {
  constructor(private readonly storageService: StorageService = new StorageService()) {}

  async generateResponse(dto: { message?: string; grade?: string; department?: string }) {
    const message = dto?.message?.trim() || '';
    const grade = dto?.grade || 'unknown';
    const department = dto?.department || 'unknown';

    if (!message) {
      return {
        status: 'error',
        message: '질문 내용을 입력해 주세요.',
      };
    }

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('인턴') || lowerMessage.includes('인턴십')) {
      return {
        status: 'success',
        category: 'internship',
        answer: `${grade} ${department} 학생에게는 인턴십 준비를 가장 먼저 시작하는 것이 좋습니다. 자기소개서와 포트폴리오를 함께 정리해 두세요.`,
        metadata: { grade, department },
      };
    }

    if (lowerMessage.includes('일정') || lowerMessage.includes('학사')) {
      return {
        status: 'success',
        category: 'schedule',
        answer: `${grade} ${department} 학생 기준으로, 학사 일정과 마감일을 먼저 확인해 두는 것이 좋습니다. 학교 공지사항과 캘린더를 함께 체크해 주세요.`,
        metadata: { grade, department },
      };
    }

    if (lowerMessage.includes('세특') || lowerMessage.includes('생기부')) {
      return {
        status: 'success',
        category: 'record',
        answer: `${department} 계열에서 세특은 프로젝트 경험과 활동 기록을 구체적으로 남기는 것이 중요합니다. 활동 내용을 숫자와 결과 중심으로 정리해 보세요.`,
        metadata: { grade, department },
      };
    }

    const response = {
      status: 'success',
      category: 'general',
      answer: `${grade} ${department} 학생 기준으로, 학사 일정과 규정 정보를 먼저 확인하는 것이 좋습니다. 추가로 어떤 규정이나 일정이 궁금한지 알려 주세요.`,
      metadata: { grade, department },
    };

    await this.storageService.saveChatLog({
      message,
      answer: response.answer,
      grade,
      department,
    });

    return response;
  }
}
