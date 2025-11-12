import {
  Entity,
  Column,
  Index,
  Unique,
} from 'typeorm';
import { HouseholdScopedEntity } from '../../shared/entities/base.entity';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from './notification.entity';

export enum TemplateStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

@Entity('notification_templates')
@Unique(['household_id', 'type', 'channel', 'name'])
@Index(['household_id', 'type'])
@Index(['household_id', 'status'])
export class NotificationTemplate extends HouseholdScopedEntity {
  // Template identification
  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel: NotificationChannel;

  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.ACTIVE,
  })
  status: TemplateStatus;

  // Template content
  @Column({ length: 200 })
  subject_template: string;

  @Column('text')
  body_template: string;

  @Column('text', { nullable: true })
  html_template?: string;

  // Metadata
  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  default_priority: NotificationPriority;

  @Column('jsonb', {
    default: {},
  })
  template_variables: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'date' | 'currency';
    description?: string;
    required?: boolean;
    default_value?: any;
    format?: string;
  }>;

  @Column('jsonb', {
    default: {},
  })
  styling: {
    email?: {
      theme?: string;
      primary_color?: string;
      secondary_color?: string;
      font_family?: string;
      header_image?: string;
    };
    sms?: {
      max_length?: number;
      include_links?: boolean;
    };
    push?: {
      icon?: string;
      badge?: number;
      sound?: string;
    };
    in_app?: {
      show_avatar?: boolean;
      highlight_color?: string;
      icon?: string;
    };
  };

  // Localization
  @Column({ length: 10, default: 'en' })
  locale: string;

  @Column('jsonb', {
    default: {},
  })
  translations: Record<string, {
    subject_template: string;
    body_template: string;
    html_template?: string;
  }>;

  // Usage tracking
  @Column({ default: 0 })
  usage_count: number;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at?: Date;

  @Column({ default: 0 })
  success_rate: number; // Percentage

  // Versioning
  @Column({ length: 50, default: '1.0.0' })
  version: string;

  @Column('uuid', { nullable: true })
  parent_template_id?: string;

  @Column({ default: false })
  is_system_template: boolean;

  @Column({ default: true })
  is_customizable: boolean;

  // Validation
  @Column('text', { nullable: true })
  validation_schema?: string; // JSON schema for template variables

  // Computed properties
  get is_active(): boolean {
    return this.status === TemplateStatus.ACTIVE;
  }

  get supported_variables(): string[] {
    return Object.keys(this.template_variables);
  }

  get required_variables(): string[] {
    return Object.entries(this.template_variables)
      .filter(([, config]) => config.required)
      .map(([name]) => name);
  }

  get estimated_length(): number {
    // Rough estimation for SMS length validation
    let length = this.body_template.length;
    
    // Subtract template variable placeholders and add average replacement length
    Object.entries(this.template_variables).forEach(([name, config]) => {
      const placeholder = `{{${name}}}`;
      const occurrences = (this.body_template.match(new RegExp(placeholder, 'g')) || []).length;
      
      if (occurrences > 0) {
        length -= placeholder.length * occurrences;
        
        // Add estimated replacement length based on type
        let replacementLength = 10; // Default
        switch (config.type) {
          case 'currency':
            replacementLength = 12; // $1,234.56
            break;
          case 'date':
            replacementLength = 10; // 2023-12-31
            break;
          case 'number':
            replacementLength = 8;
            break;
          case 'boolean':
            replacementLength = 5; // true/false
            break;
          case 'string':
          default:
            replacementLength = 15;
            break;
        }
        
        length += replacementLength * occurrences;
      }
    });
    
    return length;
  }

  // Helper methods
  renderTemplate(variables: Record<string, any>, locale?: string): {
    subject: string;
    body: string;
    html?: string;
  } {
    const templates = locale && this.translations[locale] 
      ? this.translations[locale]
      : {
          subject_template: this.subject_template,
          body_template: this.body_template,
          html_template: this.html_template,
        };

    const subject = this.interpolateTemplate(templates.subject_template, variables);
    const body = this.interpolateTemplate(templates.body_template, variables);
    const html = templates.html_template 
      ? this.interpolateTemplate(templates.html_template, variables)
      : undefined;

    return { subject, body, html };
  }

  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = variables[varName];
      const config = this.template_variables[varName];
      
      if (value === undefined || value === null) {
        return config?.default_value?.toString() || '';
      }

      // Format based on type
      switch (config?.type) {
        case 'currency':
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(value));
        case 'date':
          return new Date(value).toLocaleDateString();
        case 'number':
          return Number(value).toLocaleString();
        default:
          return String(value);
      }
    });
  }

  validateVariables(variables: Record<string, any>): {
    isValid: boolean;
    missingRequired: string[];
    invalidTypes: string[];
  } {
    const missingRequired: string[] = [];
    const invalidTypes: string[] = [];

    Object.entries(this.template_variables).forEach(([name, config]) => {
      const value = variables[name];

      if (config.required && (value === undefined || value === null)) {
        missingRequired.push(name);
        return;
      }

      if (value !== undefined && value !== null) {
        const isValidType = this.validateVariableType(value, config.type);
        if (!isValidType) {
          invalidTypes.push(name);
        }
      }
    });

    return {
      isValid: missingRequired.length === 0 && invalidTypes.length === 0,
      missingRequired,
      invalidTypes,
    };
  }

  private validateVariableType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'currency':
        return typeof value === 'number' && !isNaN(value) && value >= 0;
      default:
        return true;
    }
  }
}