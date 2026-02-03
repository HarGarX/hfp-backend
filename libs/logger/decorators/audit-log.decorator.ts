import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../services/audit-log.service';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: AuditAction;
  resource: string;
}

/**
 * Decorator to mark a method for audit logging
 * @param action The type of action being performed
 * @param resource The resource type being acted upon
 */
export const AuditLog = (action: AuditAction, resource: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, resource } as AuditLogMetadata);
