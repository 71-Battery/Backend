import { Injectable } from '@nestjs/common';
import { ApiException } from './common/api-exception';
import {
  sanitizeAdminContent,
  sanitizeAdminPlainText,
} from './content-sanitizer';
import { SupabaseService } from './supabase.service';

export type ResourceType = 'SCHEDULE' | 'NOTICE' | 'RULE';
export type AppRole = 'STUDENT' | 'CONTENT_EDITOR' | 'ADMIN';

export type AppProfileRow = {
  userId: string;
  appRole: AppRole;
  interests: string[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  appRole: AppRole;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type ProfileFallbackRow = {
  dataGsmStudentId: string | null;
  name: string | null;
  grade: number | null;
  classNum: number | null;
  number: number | null;
  studentNumber: number | null;
  major: 'SW_DEVELOPMENT' | 'SMART_IOT' | 'AI' | null;
  specialty: string | null;
  dataGsmRole: string | null;
};

export type NoticeRow = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  department: string | null;
  publishedAt: string;
  deadlineAt: string | null;
  targetGrades: number[];
  targetMajors: string[];
  sourceUrl: string | null;
  version: number;
  updatedAt: string;
};

export type RegulationRow = NoticeRow & {
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type SavedResourceRow = {
  userId: string;
  resourceType: ResourceType;
  resourceId: string;
  savedAt: string;
};

@Injectable()
export class RepositoryService {
  private readonly allowMemory =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_IN_MEMORY_REPOSITORY === 'true';

  private readonly memoryProfiles = new Map<string, AppProfileRow>();
  private readonly memoryFallbacks = new Map<string, ProfileFallbackRow>();
  private readonly memoryNotices: NoticeRow[] = [];
  private readonly memoryRegulations: RegulationRow[] = [];
  private readonly memorySaved = new Map<string, SavedResourceRow>();

  constructor(private readonly supabase: SupabaseService = new SupabaseService()) {}

  async createSignupProfile(input: {
    userId: string;
    dataGsmStudentId: string;
    name: string;
    grade: number | null;
    classNum: number | null;
    number: number | null;
    studentNumber: number;
    major: 'SW_DEVELOPMENT' | 'SMART_IOT' | 'AI' | null;
    specialty: string | null;
    dataGsmRole: string | null;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    notificationsEnabled: boolean;
  }) {
    const now = new Date().toISOString();
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      this.memoryProfiles.set(input.userId, {
        userId: input.userId,
        appRole: 'STUDENT',
        interests: [],
      });
      this.memoryFallbacks.set(input.userId, {
        dataGsmStudentId: input.dataGsmStudentId,
        name: input.name || null,
        grade: input.grade,
        classNum: input.classNum,
        number: input.number,
        studentNumber: input.studentNumber,
        major: input.major,
        specialty: input.specialty,
        dataGsmRole: input.dataGsmRole,
      });
      return;
    }

    try {
      const { error: profileError } = await this.supabase.db
        .from('profiles')
        .upsert(
          {
            user_id: input.userId,
            app_role: 'STUDENT',
            notifications_enabled: input.notificationsEnabled,
            terms_version: input.termsAccepted ? '2026-07-23' : null,
            terms_accepted_at: input.termsAccepted ? now : null,
            privacy_version: input.privacyAccepted ? '2026-07-23' : null,
            privacy_accepted_at: input.privacyAccepted ? now : null,
          },
          { onConflict: 'user_id' },
        );
      if (profileError) this.databaseError();

      const { error: fallbackError } = await this.supabase.db
        .from('profile_fallbacks')
        .upsert(
          {
            user_id: input.userId,
            data_gsm_student_id: input.dataGsmStudentId,
            name: input.name || null,
            grade: input.grade,
            class_num: input.classNum,
            number: input.number,
            student_number: input.studentNumber,
            major: input.major,
            specialty: input.specialty,
            data_gsm_role: input.dataGsmRole,
            source: 'DATA_GSM_SNAPSHOT',
            data_gsm_synced_at: now,
          },
          { onConflict: 'user_id' },
        );
      if (fallbackError) this.databaseError();
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async saveProfileSnapshot(
    userId: string,
    input: {
      id: string;
      name: string;
      grade: number | null;
      classNum: number | null;
      number: number | null;
      studentNumber: number | null;
      major: 'SW_DEVELOPMENT' | 'SMART_IOT' | 'AI' | null;
      specialty: string | null;
      role: string | null;
    },
  ) {
    const snapshot: ProfileFallbackRow = {
      dataGsmStudentId: input.id,
      name: input.name,
      grade: input.grade,
      classNum: input.classNum,
      number: input.number,
      studentNumber: input.studentNumber,
      major: input.major,
      specialty: input.specialty,
      dataGsmRole: input.role,
    };
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      this.memoryFallbacks.set(userId, snapshot);
      return;
    }
    try {
      const { error } = await this.supabase.db
        .from('profile_fallbacks')
        .upsert(
          {
            user_id: userId,
            data_gsm_student_id: input.id,
            name: input.name,
            grade: input.grade,
            class_num: input.classNum,
            number: input.number,
            student_number: input.studentNumber,
            major: input.major,
            specialty: input.specialty,
            data_gsm_role: input.role,
            source: 'DATA_GSM_SNAPSHOT',
            data_gsm_synced_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (error) this.databaseError();
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getAppProfile(userId: string): Promise<AppProfileRow> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const profile = this.memoryProfiles.get(userId);
      if (!profile) {
        throw new ApiException(
          'USER_NOT_FOUND',
          '사용자 정보를 찾을 수 없습니다.',
          404,
        );
      }
      return profile;
    }

    try {
      const { data, error } = await this.supabase.db
        .from('profiles')
        .select('user_id,app_role,interests')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) this.databaseError();
      if (!data) {
        throw new ApiException(
          'USER_NOT_FOUND',
          '사용자 정보를 찾을 수 없습니다.',
          404,
        );
      }
      return {
        userId,
        appRole: this.parseAppRole(data.app_role),
        interests: Array.isArray(data.interests)
          ? data.interests.filter((value: unknown) => typeof value === 'string')
          : [],
      };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async hasAppProfile(userId: string): Promise<boolean> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      return this.memoryProfiles.has(userId);
    }

    try {
      const { data, error } = await this.supabase.db
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) this.databaseError();
      return Boolean(data);
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getProfileFallback(
    userId: string,
  ): Promise<ProfileFallbackRow | null> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      return this.memoryFallbacks.get(userId) || null;
    }

    try {
      const { data, error } = await this.supabase.db
        .from('profile_fallbacks')
        .select(
          'data_gsm_student_id,name,grade,class_num,number,student_number,major,specialty,data_gsm_role',
        )
        .eq('user_id', userId)
        .maybeSingle();
      if (error) this.databaseError();
      if (!data) return null;
      return {
        dataGsmStudentId: this.nullableString(data.data_gsm_student_id),
        name: this.nullableString(data.name),
        grade: this.nullableNumber(data.grade),
        classNum: this.nullableNumber(data.class_num),
        number: this.nullableNumber(data.number),
        studentNumber: this.nullableNumber(data.student_number),
        major: this.parseMajor(data.major),
        specialty: this.nullableString(data.specialty),
        dataGsmRole: this.nullableString(data.data_gsm_role),
      };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getNotices(): Promise<NoticeRow[]> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      return [...this.memoryNotices];
    }
    try {
      const { data, error } = await this.supabase.db
        .from('notices')
        .select(
          'id,title,summary,content,category,department,published_at,deadline_at,target_grades,target_majors,source_url,version,updated_at',
        )
        .eq('status', 'PUBLISHED')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });
      if (error) this.databaseError();
      return (data || []).map((row) => this.mapNotice(row));
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getRegulations(): Promise<RegulationRow[]> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      return [...this.memoryRegulations];
    }
    try {
      const { data, error } = await this.supabase.db
        .from('regulations')
        .select(
          'id,title,summary,content,category,department,published_at,effective_from,effective_to,target_grades,target_majors,source_url,version,updated_at',
        )
        .eq('status', 'PUBLISHED')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });
      if (error) this.databaseError();
      return (data || []).map((row) => ({
        ...this.mapNotice(row),
        effectiveFrom: this.nullableString(row.effective_from),
        effectiveTo: this.nullableString(row.effective_to),
      }));
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async getSavedResources(userId: string): Promise<SavedResourceRow[]> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      return [...this.memorySaved.values()]
        .filter((item) => item.userId === userId)
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    }
    try {
      const { data, error } = await this.supabase.db
        .from('saved_resources')
        .select('user_id,resource_type,resource_id,saved_at')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });
      if (error) this.databaseError();
      return (data || []).map((row) => ({
        userId: String(row.user_id),
        resourceType: row.resource_type as ResourceType,
        resourceId: String(row.resource_id),
        savedAt: String(row.saved_at),
      }));
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async saveResource(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<SavedResourceRow> {
    const savedAt = new Date().toISOString();
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const row = { userId, resourceType, resourceId, savedAt };
      this.memorySaved.set(this.savedKey(userId, resourceType, resourceId), row);
      return row;
    }
    try {
      const { data, error } = await this.supabase.db
        .from('saved_resources')
        .upsert(
          {
            user_id: userId,
            resource_type: resourceType,
            resource_id: resourceId,
            saved_at: savedAt,
          },
          { onConflict: 'user_id,resource_type,resource_id' },
        )
        .select('user_id,resource_type,resource_id,saved_at')
        .single();
      if (error || !data) this.databaseError();
      return {
        userId: String(data.user_id),
        resourceType: data.resource_type as ResourceType,
        resourceId: String(data.resource_id),
        savedAt: String(data.saved_at),
      };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async deleteSavedResource(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      this.memorySaved.delete(this.savedKey(userId, resourceType, resourceId));
      return;
    }
    try {
      const { error } = await this.supabase.db
        .from('saved_resources')
        .delete()
        .eq('user_id', userId)
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId);
      if (error) this.databaseError();
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async createRegulation(input: {
    title: string;
    content: string;
    category: string;
    userId: string;
  }) {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const now = new Date().toISOString();
      const row: RegulationRow = {
        id: `rule-${Date.now()}`,
        title: input.title,
        summary: '',
        content: input.content,
        category: input.category,
        department: null,
        publishedAt: now,
        deadlineAt: null,
        effectiveFrom: null,
        effectiveTo: null,
        targetGrades: [],
        targetMajors: [],
        sourceUrl: null,
        version: 1,
        updatedAt: now,
      };
      this.memoryRegulations.unshift(row);
      return row;
    }
    try {
      const { data, error } = await this.supabase.db
        .from('regulations')
        .insert({
          title: input.title,
          content: input.content,
          category: input.category,
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
          created_by: input.userId,
        })
        .select(
          'id,title,summary,content,category,department,published_at,effective_from,effective_to,target_grades,target_majors,source_url,version,updated_at',
        )
        .single();
      if (error || !data) this.databaseError();
      return {
        ...this.mapNotice(data),
        effectiveFrom: this.nullableString(data.effective_from),
        effectiveTo: this.nullableString(data.effective_to),
      };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async updateRegulation(
    regulationId: string,
    input: {
      title: string;
      content: string;
      category: string;
    },
  ): Promise<RegulationRow> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const index = this.memoryRegulations.findIndex(
        (item) => item.id === regulationId,
      );
      if (index < 0) {
        throw new ApiException(
          'REGULATION_NOT_FOUND',
          '수정할 규정을 찾을 수 없습니다.',
          404,
        );
      }
      const updated = {
        ...this.memoryRegulations[index],
        ...input,
        version: this.memoryRegulations[index].version + 1,
        updatedAt: new Date().toISOString(),
      };
      this.memoryRegulations[index] = updated;
      return updated;
    }

    try {
      const { data, error } = await this.supabase.db
        .from('regulations')
        .update({
          title: input.title,
          content: input.content,
          category: input.category,
        })
        .eq('id', regulationId)
        .select(
          'id,title,summary,content,category,department,published_at,effective_from,effective_to,target_grades,target_majors,source_url,version,updated_at',
        )
        .maybeSingle();
      if (error) this.databaseError();
      if (!data) {
        throw new ApiException(
          'REGULATION_NOT_FOUND',
          '수정할 규정을 찾을 수 없습니다.',
          404,
        );
      }
      return {
        ...this.mapNotice(data),
        effectiveFrom: this.nullableString(data.effective_from),
        effectiveTo: this.nullableString(data.effective_to),
      };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async deleteRegulation(regulationId: string): Promise<void> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const index = this.memoryRegulations.findIndex(
        (item) => item.id === regulationId,
      );
      if (index < 0) {
        throw new ApiException(
          'REGULATION_NOT_FOUND',
          '삭제할 규정을 찾을 수 없습니다.',
          404,
        );
      }
      this.memoryRegulations.splice(index, 1);
      return;
    }

    try {
      const { data, error } = await this.supabase.db
        .from('regulations')
        .delete()
        .eq('id', regulationId)
        .select('id')
        .maybeSingle();
      if (error) this.databaseError();
      if (!data) {
        throw new ApiException(
          'REGULATION_NOT_FOUND',
          '삭제할 규정을 찾을 수 없습니다.',
          404,
        );
      }
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async createNotice(input: {
    title: string;
    summary: string;
    content: string;
    category: string;
    userId: string;
  }): Promise<NoticeRow> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const now = new Date().toISOString();
      const row: NoticeRow = {
        id: `notice-${Date.now()}`,
        title: input.title,
        summary: input.summary,
        content: input.content,
        category: input.category,
        department: null,
        publishedAt: now,
        deadlineAt: null,
        targetGrades: [],
        targetMajors: [],
        sourceUrl: null,
        version: 1,
        updatedAt: now,
      };
      this.memoryNotices.unshift(row);
      return row;
    }

    try {
      const { data, error } = await this.supabase.db
        .from('notices')
        .insert({
          title: input.title,
          summary: input.summary,
          content: input.content,
          category: input.category,
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
          created_by: input.userId,
        })
        .select(
          'id,title,summary,content,category,department,published_at,deadline_at,target_grades,target_majors,source_url,version,updated_at',
        )
        .single();
      if (error || !data) this.databaseError();
      return this.mapNotice(data);
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async listAppUsers(
    page: number,
    perPage: number,
  ): Promise<{ users: AdminUserRow[]; total: number }> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const users = [...this.memoryProfiles.values()]
        .slice((page - 1) * perPage, page * perPage)
        .map((profile) => ({
          id: profile.userId,
          email: '',
          name: this.memoryFallbacks.get(profile.userId)?.name || '사용자',
          appRole: profile.appRole,
          emailConfirmed: true,
          createdAt: '',
          lastSignInAt: null,
        }));
      return { users, total: this.memoryProfiles.size };
    }

    try {
      const { data: authData, error: authError } =
        await this.supabase.db.auth.admin.listUsers({ page, perPage });
      if (authError) this.databaseError();

      const authUsers = authData.users || [];
      const userIds = authUsers.map((user) => user.id);
      if (userIds.length === 0) {
        return {
          users: [],
          total: Number((authData as { total?: number }).total || 0),
        };
      }

      const [
        { data: profileRows, error: profileError },
        { data: fallbackRows, error: fallbackError },
      ] = await Promise.all([
        this.supabase.db
          .from('profiles')
          .select('user_id,app_role')
          .in('user_id', userIds),
        this.supabase.db
          .from('profile_fallbacks')
          .select('user_id,name')
          .in('user_id', userIds),
      ]);
      if (profileError || fallbackError) this.databaseError();

      const roles = new Map(
        (profileRows || []).map((row) => [
          String(row.user_id),
          this.parseAppRole(row.app_role),
        ]),
      );
      const names = new Map(
        (fallbackRows || []).map((row) => [
          String(row.user_id),
          sanitizeAdminPlainText(String(row.name || '')),
        ]),
      );

      return {
        users: authUsers.map((user) => ({
          id: user.id,
          email: String(user.email || '').trim().toLowerCase(),
          name:
            names.get(user.id) ||
            sanitizeAdminPlainText(String(user.user_metadata?.name || '')) ||
            '사용자',
          appRole: roles.get(user.id) || 'STUDENT',
          emailConfirmed: Boolean(user.email_confirmed_at),
          createdAt: String(user.created_at || ''),
          lastSignInAt: this.nullableString(user.last_sign_in_at),
        })),
        total: Number(
          (authData as { total?: number }).total || authUsers.length,
        ),
      };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async updateAppRole(userId: string, appRole: AppRole): Promise<AppProfileRow> {
    if (!this.supabase.hasDatabaseConfig) {
      this.assertMemoryAllowed();
      const profile = this.memoryProfiles.get(userId);
      if (!profile) {
        throw new ApiException(
          'USER_NOT_FOUND',
          '사용자 정보를 찾을 수 없습니다.',
          404,
        );
      }
      const updated = { ...profile, appRole };
      this.memoryProfiles.set(userId, updated);
      return updated;
    }

    try {
      const { data, error } = await this.supabase.db
        .from('profiles')
        .update({ app_role: appRole })
        .eq('user_id', userId)
        .select('user_id,app_role,interests')
        .maybeSingle();
      if (error) this.databaseError();
      if (!data) {
        throw new ApiException(
          'USER_NOT_FOUND',
          '사용자 정보를 찾을 수 없습니다.',
          404,
        );
      }
      return {
        userId: String(data.user_id),
        appRole: this.parseAppRole(data.app_role),
        interests: this.stringArray(data.interests),
      };
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  private mapNotice(row: Record<string, any>): NoticeRow {
    return {
      id: String(row.id),
      title: sanitizeAdminPlainText(String(row.title)),
      summary: sanitizeAdminPlainText(String(row.summary || '')),
      content: sanitizeAdminContent(String(row.content)),
      category: sanitizeAdminPlainText(String(row.category || '일반')),
      department: row.department
        ? sanitizeAdminPlainText(String(row.department))
        : null,
      publishedAt: String(row.published_at),
      deadlineAt: this.nullableString(row.deadline_at),
      targetGrades: this.numberArray(row.target_grades),
      targetMajors: this.stringArray(row.target_majors),
      sourceUrl: this.nullableString(row.source_url),
      version: Number(row.version || 1),
      updatedAt: String(row.updated_at),
    };
  }

  private parseAppRole(value: unknown): AppRole {
    return value === 'ADMIN' || value === 'CONTENT_EDITOR'
      ? value
      : 'STUDENT';
  }

  private parseMajor(value: unknown): ProfileFallbackRow['major'] {
    return value === 'SW_DEVELOPMENT' || value === 'SMART_IOT' || value === 'AI'
      ? value
      : null;
  }

  private nullableString(value: unknown) {
    return typeof value === 'string' && value ? value : null;
  }

  private nullableNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private numberArray(value: unknown): number[] {
    return Array.isArray(value)
      ? value.filter(
          (item): item is number =>
            typeof item === 'number' && Number.isInteger(item),
        )
      : [];
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private savedKey(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ) {
    return `${userId}:${resourceType}:${resourceId}`;
  }

  private assertMemoryAllowed(): void {
    if (!this.allowMemory) {
      throw new ApiException(
        'DATABASE_NOT_CONFIGURED',
        '데이터 저장소가 구성되지 않았습니다.',
        503,
      );
    }
  }

  private databaseError(): never {
    throw new ApiException(
      'DATABASE_UNAVAILABLE',
      '데이터를 불러올 수 없습니다.',
      503,
    );
  }

  private rethrowDatabaseError(error: unknown): never {
    if (error instanceof ApiException) throw error;
    this.databaseError();
  }
}
