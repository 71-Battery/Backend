import { createHash } from 'crypto';

export class AuthService {
  private static readonly secret = 'gsm-dev-secret';

  async login(email: string, password: string) {
    if (!email || !password) {
      return {
        status: 'error',
        message: '이메일과 비밀번호를 입력해 주세요.',
      };
    }

    if (!email.includes('@')) {
      return {
        status: 'error',
        message: '올바른 이메일 형식이 아닙니다.',
      };
    }

    const token = this.createToken({ email, role: 'student' });

    return {
      status: 'success',
      message: '로그인 요청이 수신되었습니다.',
      user: {
        email,
        role: 'student',
      },
      token,
    };
  }

  async verifyToken(token: string) {
    if (!token) {
      return null;
    }

    const payload = this.decodeToken(token);
    return payload;
  }

  private createToken(payload: { email: string; role: string }) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHash('sha256').update(`${header}.${body}.${AuthService.secret}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  private decodeToken(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [, body] = parts;
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  }
}
