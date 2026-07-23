import { Injectable } from '@nestjs/common';
import { hasSupabaseConfig, supabaseClient } from './supabase.module';

@Injectable()
export class RepositoryService {
  async saveChatLog(entry: { message: string; answer: string; grade?: string; department?: string }) {
    if (!hasSupabaseConfig || !supabaseClient) {
      return {
        status: 'skipped',
        reason: 'supabase-not-configured',
      };
    }

    try {
      const { error } = await supabaseClient.from('chat_logs').insert({
        message: entry.message,
        answer: entry.answer,
        grade: entry.grade || 'unknown',
        department: entry.department || 'unknown',
      });

      if (error) {
        return {
          status: 'error',
          message: error.message,
        };
      }

      return {
        status: 'saved',
        storage: 'supabase',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || '저장 실패',
      };
    }
  }

  async saveRule(rule: { title: string; content: string; category?: string }) {
    if (!hasSupabaseConfig || !supabaseClient) {
      return {
        status: 'skipped',
        reason: 'supabase-not-configured',
      };
    }

    try {
      const { error } = await supabaseClient.from('rules').insert({
        title: rule.title,
        content: rule.content,
        category: rule.category || 'general',
      });

      if (error) {
        return {
          status: 'error',
          message: error.message,
        };
      }

      return {
        status: 'saved',
        storage: 'supabase',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || '저장 실패',
      };
    }
  }
}
