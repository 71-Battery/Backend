import { Injectable } from '@nestjs/common';
import { hasSupabaseConfig, supabaseClient } from './supabase.module';

@Injectable()
export class SupabaseService {
  async getHealth() {
    if (!hasSupabaseConfig || !supabaseClient) {
      return {
        status: 'not-configured',
        message: 'Supabase URL and service role key are not configured yet.',
      };
    }

    const { data, error } = await supabaseClient.from('users').select('*').limit(1);

    if (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }

    return {
      status: 'ok',
      count: data?.length ?? 0,
    };
  }
}
