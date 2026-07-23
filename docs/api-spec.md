<!--
API 명세서 템플릿입니다.
이 프로젝트는 백엔드 API 중심으로 구현하므로, 외부 클라이언트가 사용할 수 있는 요청/응답 형식을 먼저 정리한다.

[작성 포인트]
- endpoint path
- request body
- response body
- 에러 응답
-->

# API 명세서

## 0. 범위
- 이 프로젝트는 백엔드 서버를 중심으로 구현하고 나중에 프론트 엔드와 db와 함께 합친다.
- 외부 클라이언트는 HTTP 요청으로 백엔드 API를 호출한다.
- 응답 형식은 JSON으로 통일한다.

## 1. 인증
### POST /api/auth/login
- 로그인 요청을 받아 JWT 토큰을 발급한다.
- request body: email, password
- response body: accessToken, refreshToken, userInfo

### POST /api/auth/refresh
- refresh token으로 access token을 재발급한다.

## 2. 챗봇 대화
### POST /api/chat
- 사용자의 질문을 받아 AI 응답을 생성한다.
- request body: message, grade, department, userId(optional)
- response body: answer, sources, status
- 실패 응답: 400(잘못된 요청), 401(인증 실패), 500(서버 오류)

## 3. 학사 정보 조회
### GET /api/guidance
- 학년과 학과를 기준으로 맞춤형 학사 가이드를 반환한다.
- query params: grade, department
- response body: summary, priorities, schedule, tips

## 4. 규정 해설
### GET /api/regulations/:topic
- 규정 주제별 간단한 설명과 상세 정보를 반환한다.
- path param: topic
- response body: topic, summary, details

## 5. 관리자 기능
### POST /api/admin/regulations
- 규정 데이터를 등록한다.

### POST /api/admin/schedules
- 학사 일정을 등록한다.
