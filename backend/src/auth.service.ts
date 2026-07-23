import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

type User = {
  email: string;
  name: string;
  passwordHash: string;
  role: 'student';
};

export class AuthService {
  private static readonly secret = process.env.AUTH_TOKEN_SECRET || 'gsm-dev-secret';
  private readonly users = new Map<string, User>();

  async signup(email: string, password: string, name = '') {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!this.isEmail(normalizedEmail)) {
      return this.error('올바른 이메일 주소를 입력해 주세요.');
    }
    if (password.length < 8) {
      return this.error('비밀번호는 8자 이상으로 입력해 주세요.');
    }
    if (password.length > 128) {
      return this.error('비밀번호는 128자 이하로 입력해 주세요.');
    }
    if (normalizedName.length > 30) {
      return this.error('이름은 30자 이하로 입력해 주세요.');
    }
    if (this.users.has(normalizedEmail)) {
      return this.error('이미 가입된 이메일입니다. 로그인해 주세요.');
    }

    const user: User = {
      email: normalizedEmail,
      name: normalizedName,
      passwordHash: this.hashPassword(password),
      role: 'student',
    };
    this.users.set(normalizedEmail, user);

    return this.success(user, '회원가입이 완료되었습니다.');
  }

  async login(email: string, password: string) {
    const user = this.users.get(email.trim().toLowerCase());
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      return this.error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    return this.success(user, '로그인되었습니다.');
  }

  async verifyToken(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expected = this.sign(`${header}.${body}`);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!payload?.email || !payload?.role) return null;
      return payload as { email: string; name: string; role: 'student' };
    } catch {
      return null;
    }
  }

  private success(user: User, message: string) {
    const publicUser = { email: user.email, name: user.name, role: user.role };
    return { status: 'success', message, user: publicUser, token: this.createToken(publicUser) };
  }

  private error(message: string) {
    return { status: 'error', message };
  }

  private isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  }

  private verifyPassword(password: string, stored: string) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const actual = Buffer.from(scryptSync(password, salt, 64).toString('hex'));
    const expected = Buffer.from(hash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private createToken(payload: { email: string; name: string; role: 'student' }) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.${this.sign(`${header}.${body}`)}`;
  }

  private sign(value: string) {
    return createHmac('sha256', AuthService.secret).update(value).digest('base64url');
  }
}
