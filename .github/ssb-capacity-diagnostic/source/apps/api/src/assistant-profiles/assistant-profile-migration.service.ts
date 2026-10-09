import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { AssistantProfileDiagnosticsService } from './assistant-profile-diagnostics.service';
import { AssistantProfileMigrationPreviewService } from './assistant-profile-migration-preview.service';

const STORAGE_LOCATION = 'site_modules[assistant-profile].config.assistantProfile';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validateProposedAssistantProfile(value: unknown) {
  const profile = asRecord(value);
  const profileKey = typeof profile.profileKey === 'string' ? profile.profileKey.trim() : '';
  const profileVersion = Number(profile.profileVersion);
  const assistantName = typeof profile.assistantName === 'string' ? profile.assistantName.trim() : '';

  if (!profileKey || !Number.isInteger(profileVersion) || profileVersion < 1 || !assistantName) {
    throw new BadRequestException('Invalid assistantProfile preview');
  }

  return profile;
}

@Injectable()
export class AssistantProfileMigrationService {
  constructor(
    private readonly preview: AssistantProfileMigrationPreviewService,
    private readonly diagnostics: AssistantProfileDiagnosticsService,
    private readonly siteModules: SiteModulesService,
    private readonly auditLogs: AuditLogService,
  ) {}

  async savePreviewAsAssistantProfile(siteId: string, tenantId?: string | null, actorId?: string | null) {
    const preview = await this.preview.getMigrationPreview(siteId);
    if (preview.blockers.length > 0) {
      throw new BadRequestException({
        message: 'AssistantProfile preview has blockers',
        blockers: preview.blockers,
      });
    }

    const assistantProfile = validateProposedAssistantProfile(preview.proposedAssistantProfile);
    const migratedAt = new Date().toISOString();
    const storageConfig = {
      assistantProfile,
      migration: {
        migratedFrom: preview.currentProfile.legacySource,
        migratedAt,
        migratedBy: actorId || 'dashboard',
        reversible: true,
        legacyFieldsPreserved: true,
        storageLocation: STORAGE_LOCATION,
      },
    };

    await this.siteModules.updateForSite(siteId, [
      {
        key: 'assistant-profile',
        isEnabled: true,
        config: storageConfig,
      },
    ]);

    await this.auditLogs.record({
      siteId,
      tenantId: tenantId || null,
      actorId: actorId || 'dashboard',
      actorRole: 'operator',
      action: 'save_assistant_profile',
      resourceType: 'assistant_profile',
      resourceId: siteId,
      metadata: {
        profileKey: assistantProfile.profileKey,
        profileVersion: assistantProfile.profileVersion,
        migratedFrom: preview.currentProfile.legacySource,
        legacyFieldsPreserved: true,
        reversible: true,
        storageLocation: STORAGE_LOCATION,
      },
    });

    return {
      saved: true,
      storageLocation: STORAGE_LOCATION,
      assistantProfileDebug: (await this.diagnostics.getDiagnostics(siteId)).assistantProfileDebug,
    };
  }
}
