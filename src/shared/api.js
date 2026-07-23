//
// 공통 API 호출 모듈입니다.
// 이 파일은 프론트엔드가 백엔드 API와 통신할 때 재사용할 fetch 함수나 공통 설정을 담습니다.
//
// 작성 포인트:
// - base URL 설정
// - 공통 헤더 설정
// - 에러 처리 함수
// - 인증 토큰 포함 로직
//

export async function request(url, options = {}) {
  return fetch(url, options);
}
