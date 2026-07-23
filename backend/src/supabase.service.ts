import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ApiException } from './common/api-exception';

const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

@Injectable()
export class SupabaseService {
  readonly url = process.env.SUPABASE_URL?.trim() || '';
  private readonly anonKey = process.env.SUPABASE_ANON_KEY?.trim() || '';
  private readonly serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

  readonly authClient: SupabaseClient | null;
  readonly dbClient: SupabaseClient | null;

  constructor() {
    this.authClient =
      this.url && this.anonKey
        ? createClient(this.url, this.anonKey, CLIENT_OPTIONS)
        : null;
    this.dbClient =
      this.url && this.serviceRoleKey
        ? createClient(this.url, this.serviceRoleKey, CLIENT_OPTIONS)
        : null;
  }

  get auth(): SupabaseClient {
    if (!this.authClient) {
      throw new ApiException(
        'AUTH_NOT_CONFIGURED',
        '인증 서비스가 구성되지 않았습니다.',
        503,
      );
    }
    return this.authClient;
  }

  get db(): SupabaseClient {
    if (!this.dbClient) {
      throw new ApiException(
        'DATABASE_NOT_CONFIGURED',
        '데이터 저장소가 구성되지 않았습니다.',
        503,
      );
    }
    return this.dbClient;
  }

  get hasAuthConfig() {
    return Boolean(this.authClient);
  }

  get hasDatabaseConfig() {
    return Boolean(this.dbClient);
  }

  async getHealth() {
    if (!this.dbClient) {
      return {
        status: 'NOT_CONFIGURED',
        service: 'supabase',
      };
    }

    try {
      const { error } = await this.dbClient
        .from('profiles')
        .select('user_id', { head: true, count: 'exact' })
        .limit(1);

      return error
        ? { status: 'DEGRADED', service: 'supabase' }
        : { status: 'OK', service: 'supabase' };
    } catch {
      return { status: 'DEGRADED', service: 'supabase' };
    }
  }
}
