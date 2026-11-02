import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export interface AuditInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass a transaction client so the audit row commits or rolls back with the action. */
  record(input: AuditInput, tx: Prisma.TransactionClient = this.prisma) {
    return tx.auditLog.create({ data: input });
  }
}
