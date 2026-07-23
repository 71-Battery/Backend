import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AdminController } from './admin.controller';
import { GuidanceController } from './guidance.controller';
import { GuidanceService } from './guidance.service';
import { HealthController } from './health.controller';
import { ProfileController } from './profile.controller';
import { RepositoryService } from './repository.service';
import { StorageService } from './storage.service';
import { SupabaseModule } from './supabase.module';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AppController, ChatController, AuthController, GuidanceController, AdminController, ProfileController, HealthController],
  providers: [AppService, SupabaseService, ChatService, AuthService, GuidanceService, StorageService, RepositoryService],
})
export class AppModule {}
