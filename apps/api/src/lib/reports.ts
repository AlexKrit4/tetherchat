import type { MessageReport, ReportAttachmentSnapshot, SiteBan } from '@tetherchat/shared';
import type { Prisma } from '@prisma/client';
import { publicUserSelect, toPublicUser } from './serialize.js';

export const reportInclude = {
  reporter: { select: publicUserSelect },
  target: { select: publicUserSelect },
  siteBan: { include: { user: { select: publicUserSelect } } },
} satisfies Prisma.MessageReportInclude;

export type ReportRow = Prisma.MessageReportGetPayload<{ include: typeof reportInclude }>;

export function toReportAttachments(json: Prisma.JsonValue): ReportAttachmentSnapshot[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.url !== 'string') return [];
    return [
      {
        url: row.url,
        filename: typeof row.filename === 'string' ? row.filename : 'file',
        contentType: typeof row.contentType === 'string' ? row.contentType : 'application/octet-stream',
        spoiler: Boolean(row.spoiler),
      },
    ];
  });
}

export function toSiteBan(row: {
  id: string;
  reason: string;
  expiresAt: Date | null;
  createdAt: Date;
  liftedAt: Date | null;
  user: Parameters<typeof toPublicUser>[0];
}): SiteBan {
  return {
    id: row.id,
    user: toPublicUser(row.user),
    reason: row.reason,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    liftedAt: row.liftedAt?.toISOString() ?? null,
  };
}

export function toMessageReport(row: ReportRow): MessageReport {
  return {
    id: row.id,
    messageId: row.messageId,
    reporter: toPublicUser(row.reporter),
    target: toPublicUser(row.target),
    comment: row.comment,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    messageContent: row.messageContent,
    messageCreatedAt: row.messageCreatedAt.toISOString(),
    attachments: toReportAttachments(row.attachmentsJson),
    ban: row.siteBan ? toSiteBan(row.siteBan) : null,
  };
}
