import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  ACCESS = 'ACCESS',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  SHARE = 'SHARE',
  REVOKE = 'REVOKE',
}

export interface AuditLogEntry {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  userId: string;
  householdId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  /**
   * Log an audit event
   */
  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    this.logger.info('Audit event', {
      context: 'Audit',
      ...auditEntry,
    });
  }

  /**
   * Log a create action
   */
  logCreate(
    resource: string,
    resourceId: string,
    userId: string,
    householdId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      action: AuditAction.CREATE,
      resource,
      resourceId,
      userId,
      householdId,
      metadata,
    });
  }

  /**
   * Log an update action
   */
  logUpdate(
    resource: string,
    resourceId: string,
    userId: string,
    householdId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      action: AuditAction.UPDATE,
      resource,
      resourceId,
      userId,
      householdId,
      metadata,
    });
  }

  /**
   * Log a delete action
   */
  logDelete(
    resource: string,
    resourceId: string,
    userId: string,
    householdId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      action: AuditAction.DELETE,
      resource,
      resourceId,
      userId,
      householdId,
      metadata,
    });
  }

  /**
   * Log a login action
   */
  logLogin(userId: string, ipAddress?: string, userAgent?: string): void {
    this.log({
      action: AuditAction.LOGIN,
      resource: 'user',
      resourceId: userId,
      userId,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a logout action
   */
  logLogout(userId: string, ipAddress?: string): void {
    this.log({
      action: AuditAction.LOGOUT,
      resource: 'user',
      resourceId: userId,
      userId,
      ipAddress,
    });
  }

  /**
   * Log a sensitive resource access
   */
  logAccess(
    resource: string,
    resourceId: string,
    userId: string,
    householdId?: string,
  ): void {
    this.log({
      action: AuditAction.ACCESS,
      resource,
      resourceId,
      userId,
      householdId,
    });
  }

  /**
   * Log a data export
   */
  logExport(
    resource: string,
    userId: string,
    householdId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      action: AuditAction.EXPORT,
      resource,
      userId,
      householdId,
      metadata,
    });
  }

  /**
   * Log a data import
   */
  logImport(
    resource: string,
    userId: string,
    householdId?: string,
    metadata?: Record<string, any>,
  ): void {
    this.log({
      action: AuditAction.IMPORT,
      resource,
      userId,
      householdId,
      metadata,
    });
  }

  /**
   * Log a share action
   */
  logShare(
    resource: string,
    resourceId: string,
    userId: string,
    sharedWithUserId: string,
    householdId?: string,
  ): void {
    this.log({
      action: AuditAction.SHARE,
      resource,
      resourceId,
      userId,
      householdId,
      metadata: { sharedWithUserId },
    });
  }

  /**
   * Log a revoke action
   */
  logRevoke(
    resource: string,
    resourceId: string,
    userId: string,
    revokedFromUserId: string,
    householdId?: string,
  ): void {
    this.log({
      action: AuditAction.REVOKE,
      resource,
      resourceId,
      userId,
      householdId,
      metadata: { revokedFromUserId },
    });
  }
}
