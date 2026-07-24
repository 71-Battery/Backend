import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AdminController } from './admin.controller';
import { AiContextService } from './ai-context.service';
import { ContentAdminGuard, SystemAdminGuard } from './app-role.guard';
import { BearerAuthGuard } from './bearer-auth.guard';
import { ContentService } from './content.service';
import { CampusAiModule } from './campus-ai/campus-ai.module';
import { CampusChatAuthGuard } from './campus-ai/campus-chat-auth.guard';
import { CampusChatExceptionFilter } from './campus-ai/campus-chat-exception.filter';
import { DataGsmModule } from './data-gsm/data-gsm.module';
import { GuidanceController } from './guidance.controller';
import { GuidanceService } from './guidance.service';
import { HealthController } from './health.controller';
import { NoticesController } from './notices.controller';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RegulationsController } from './regulations.controller';
import { RepositoryService } from './repository.service';
import { SavedResourcesController } from './saved-resources.controller';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { SupabaseModule } from './supabase.module';

@Module({
  imports: [SupabaseModule, DataGsmModule, CampusAiModule],
  controllers: [
    AppController,
    AuthController,
    ProfileController,
    SchedulesController,
    NoticesController,
    RegulationsController,
    SavedResourcesController,
    ChatController,
    GuidanceController,
    AdminController,
    HealthController,
  ],
  providers: [
    AppService,
    AuthService,
    BearerAuthGuard,
    CampusChatAuthGuard,
    CampusChatExceptionFilter,
    ContentAdminGuard,
    SystemAdminGuard,
    RepositoryService,
    ProfileService,
    SchedulesService,
    ContentService,
    AiContextService,
    ChatService,
    GuidanceService,
  ],
})
export class AppModule {}
