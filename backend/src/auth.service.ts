import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { ApiException } from './common/api-exception';
import type { AuthenticatedUser } from './common/authenticated-user';
import { DataGsmClient } from './data-gsm/data-gsm.client';
import { RepositoryService } from './repository.service';
import { SupabaseService } from './supabase.service';

const gsmEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254)
  .refine((email) => email.endsWith('@gsm.hs.kr'), {
    message: 'GSM 학교 이메일(@gsm.hs.kr)을 사용해 주세요.',
  });

const passwordSchema = z.string().min(8).max(128);

type MemoryUser = AuthenticatedUser & {
  name: string;
  passwordHash: string;
};

@Injectable()
export class AuthService {
  private readonly memoryUsers = new Map<string, MemoryUser>();
  private readonly memoryTokens = new Map<string, AuthenticatedUser>();
  private readonly allowMemoryAuth =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_IN_MEMORY_AUTH === 'true';

  constructor(
    private readonly supabase: SupabaseService = new SupabaseService(),
    private readonly repository: RepositoryService = new RepositoryService(
      supabase,
    ),
    private readonly dataGsm: DataGsmClient = new DataGsmClient(),
  ) {}

  async signup(
    email: string,
    password: string,
    name = '',
    studentNumberValue?: unknown,
    agreementsValue?: unknown,
  ) {
    const normalizedEmail = this.parseEmail(email);
    this.parsePassword(password);
    const parsedName = z.string().trim().min(1).max(100).safeParse(name || '');
    if (!parsedName.success) {
      throw new ApiException(
        'INVALID_NAME',
        '이름은 1자 이상 100자 이하로 입력해 주세요.',
        400,
      );
    }
    const normalizedName = parsedName.data;
    const studentNumber = z
      .number()
      .int()
      .min(1000)
      .max(99_999_999)
      .safeParse(studentNumberValue);
    const agreements = z
      .object({
        terms: z.literal(true),
        privacy: z.literal(true),
        notifications: z.boolean().optional().default(false),
      })
      .safeParse(agreementsValue);
    if (!studentNumber.success) {
      throw new ApiException(
        'INVALID_STUDENT_NUMBER',
        '학번은 숫자 4~8자리로 입력해 주세요.',
        400,
      );
    }
    if (!agreements.success) {
      throw new ApiException(
        'REQUIRED_AGREEMENTS_MISSING',
        '필수 약관 동의를 확인해 주세요.',
        400,
      );
    }

    await this.verifyStudentIdentity(normalizedEmail, studentNumber.data);

    if (!this.supabase.hasAuthConfig) {
      if (this.allowMemoryAuth) {
        const response = this.memorySignup(
          normalizedEmail,
          password,
          normalizedName,
        );
        await this.repository.createSignupProfile({
          userId: response.data.user.id,
          name: normalizedName,
          studentNumber: studentNumber.data,
          termsAccepted: true,
          privacyAccepted: true,
          notificationsEnabled: agreements.data.notifications,
        });
        return response;
      }
      throw new ApiException(
        'AUTH_NOT_CONFIGURED',
        '인증 서비스가 구성되지 않았습니다.',
        503,
      );
    }
    if (!this.supabase.hasDatabaseConfig) {
      throw new ApiException(
        'DATABASE_NOT_CONFIGURED',
        '사용자 프로필 저장소가 구성되지 않았습니다.',
        503,
      );
    }

    let result;
    try {
      const emailRedirectTo = this.resolveEmailRedirectUrl();
      result = await this.supabase.auth.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: normalizedName ? { name: normalizedName } : {},
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });
    } catch {
      throw new ApiException(
        'AUTH_PROVIDER_UNAVAILABLE',
        '인증 서비스에 연결할 수 없습니다.',
        503,
      );
    }

    if (
      result.error ||
      !result.data.user ||
      result.data.user.email?.trim().toLowerCase() !== normalizedEmail ||
      (Array.isArray(result.data.user.identities) &&
        result.data.user.identities.length === 0)
    ) {
      throw new ApiException(
        'SIGNUP_FAILED',
        '회원가입을 완료할 수 없습니다. 입력 정보를 확인해 주세요.',
        400,
      );
    }

    try {
      await this.repository.createSignupProfile({
        userId: result.data.user.id,
        name: normalizedName,
        studentNumber: studentNumber.data,
        termsAccepted: true,
        privacyAccepted: true,
        notificationsEnabled: agreements.data.notifications,
      });
    } catch (error) {
      // Supabase Auth and PostgREST cannot share one transaction. Remove only
      // the user created by this request when profile provisioning fails.
      try {
        await this.supabase.db.auth.admin.deleteUser(result.data.user.id);
      } catch {
        // Preserve the original safe database error.
      }
      throw error;
    }

    const session = result.data.session;
    return {
      status: 'OK',
      data: {
        user: {
          id: result.data.user.id,
          email: normalizedEmail,
          name: normalizedName,
        },
        session: session
          ? this.toPublicSession(session.access_token, session.refresh_token, session.expires_at)
          : null,
        token: session?.access_token || null,
        verificationRequired: !result.data.user.email_confirmed_at,
      },
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.parseEmail(email);
    this.parsePassword(password);

    if (!this.supabase.hasAuthConfig) {
      if (this.allowMemoryAuth) {
        return this.memoryLogin(normalizedEmail, password);
      }
      throw new ApiException(
        'AUTH_NOT_CONFIGURED',
        '인증 서비스가 구성되지 않았습니다.',
        503,
      );
    }

    let result;
    try {
      result = await this.supabase.auth.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
    } catch {
      throw new ApiException(
        'AUTH_PROVIDER_UNAVAILABLE',
        '인증 서비스에 연결할 수 없습니다.',
        503,
      );
    }

    if (result.error || !result.data.user || !result.data.session) {
      const notVerified =
        result.error?.message?.toLowerCase().includes('email not confirmed') ?? false;
      throw new ApiException(
        notVerified ? 'EMAIL_NOT_VERIFIED' : 'INVALID_CREDENTIALS',
        notVerified
          ? '학교 이메일 인증을 완료해 주세요.'
          : '이메일 또는 비밀번호가 올바르지 않습니다.',
        notVerified ? 403 : 401,
      );
    }

    if (!result.data.user.email_confirmed_at) {
      throw new ApiException(
        'EMAIL_NOT_VERIFIED',
        '학교 이메일 인증을 완료해 주세요.',
        403,
      );
    }

    const verifiedEmail = this.parseEmail(result.data.user.email || '');
    if (verifiedEmail !== normalizedEmail) {
      throw new ApiException(
        'INVALID_AUTH_IDENTITY',
        '인증된 사용자 정보를 확인할 수 없습니다.',
        401,
      );
    }

    return {
      status: 'OK',
      data: {
        user: {
          id: result.data.user.id,
          email: verifiedEmail,
          name:
            typeof result.data.user.user_metadata?.name === 'string'
              ? result.data.user.user_metadata.name
              : '',
        },
        session: this.toPublicSession(
          result.data.session.access_token,
          result.data.session.refresh_token,
          result.data.session.expires_at,
        ),
        token: result.data.session.access_token,
      },
    };
  }

  async logout(token: string) {
    if (!token || token.length > 8192) {
      throw new ApiException(
        'INVALID_TOKEN',
        '로그인이 만료되었거나 유효하지 않습니다.',
        401,
      );
    }

    if (this.allowMemoryAuth && this.memoryTokens.delete(token)) return;

    if (!this.supabase.hasAuthConfig) {
      throw new ApiException(
        'AUTH_NOT_CONFIGURED',
        '인증 서비스가 구성되지 않았습니다.',
        503,
      );
    }

    try {
      const { error } = await this.supabase.auth.auth.admin.signOut(
        token,
        'local',
      );
      if (error) {
        throw new ApiException(
          'AUTH_PROVIDER_UNAVAILABLE',
          '인증 서비스에 연결할 수 없습니다.',
          503,
        );
      }
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(
        'AUTH_PROVIDER_UNAVAILABLE',
        '인증 서비스에 연결할 수 없습니다.',
        503,
      );
    }
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser | null> {
    if (!token || token.length > 8192) return null;

    if (this.allowMemoryAuth && this.memoryTokens.has(token)) {
      return this.memoryTokens.get(token) || null;
    }

    if (!this.supabase.hasAuthConfig) return null;

    try {
      const { data, error } = await this.supabase.auth.auth.getUser(token);
      if (error || !data.user?.email || !data.user.email_confirmed_at) return null;

      const email = this.parseEmail(data.user.email);
      return { id: data.user.id, email };
    } catch {
      return null;
    }
  }

  private parseEmail(value: string) {
    const parsed = gsmEmailSchema.safeParse(value);
    if (!parsed.success) {
      throw new ApiException(
        'INVALID_SCHOOL_EMAIL',
        parsed.error.issues[0]?.message || '학교 이메일을 확인해 주세요.',
        400,
      );
    }
    return parsed.data;
  }

  private parsePassword(value: string) {
    const parsed = passwordSchema.safeParse(value);
    if (!parsed.success) {
      throw new ApiException(
        'INVALID_PASSWORD',
        '비밀번호는 8자 이상 128자 이하여야 합니다.',
        400,
      );
    }
    return parsed.data;
  }

  private toPublicSession(
    accessToken: string,
    _refreshToken: string,
    expiresAt?: number,
  ) {
    return {
      accessToken,
      expiresAt: expiresAt || null,
      tokenType: 'bearer',
    };
  }

  private memorySignup(email: string, password: string, name: string) {
    if (this.memoryUsers.has(email)) {
      throw new ApiException(
        'SIGNUP_FAILED',
        '회원가입을 완료할 수 없습니다. 입력 정보를 확인해 주세요.',
        400,
      );
    }

    const user: MemoryUser = {
      id: randomUUID(),
      email,
      name,
      passwordHash: this.hashPassword(password),
    };
    this.memoryUsers.set(email, user);
    return this.memorySessionResponse(user);
  }

  private async verifyStudentIdentity(email: string, studentNumber: number) {
    const student = await this.dataGsm.getStudentByEmail(email);
    if (!student || student.studentNumber !== studentNumber) {
      throw new ApiException(
        'STUDENT_IDENTITY_MISMATCH',
        '학교 이메일과 학번이 재학생 정보와 일치하지 않습니다.',
        400,
      );
    }
  }

  private resolveEmailRedirectUrl() {
    const configuredRedirect = process.env.AUTH_EMAIL_REDIRECT_URL?.trim();
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    for (const candidate of [configuredRedirect, ...allowedOrigins]) {
      if (!candidate) continue;

      try {
        const url = new URL(candidate);
        const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(
          url.hostname,
        );
        const isAllowedProtocol =
          url.protocol === 'https:' ||
          (process.env.NODE_ENV !== 'production' &&
            url.protocol === 'http:' &&
            isLoopback);

        if (
          !isAllowedProtocol ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        ) {
          continue;
        }

        return new URL('/auth/confirmed', url.origin).toString();
      } catch {
        // Ignore malformed server configuration and try the next safe origin.
      }
    }

    return undefined;
  }

  private memoryLogin(email: string, password: string) {
    const user = this.memoryUsers.get(email);
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new ApiException(
        'INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않습니다.',
        401,
      );
    }
    return this.memorySessionResponse(user);
  }

  private memorySessionResponse(user: MemoryUser) {
    const token = randomBytes(48).toString('base64url');
    this.memoryTokens.set(token, { id: user.id, email: user.email });
    return {
      status: 'OK',
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        session: this.toPublicSession(token, '', undefined),
        token,
        verificationRequired: false,
      },
    };
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
}
