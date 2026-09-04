import { MemberRole } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";

export type CreateNotificationInput = {
  userId: string;
  organizationId?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createNotification(input: CreateNotificationInput) {
  return firestoreDb.notification.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function notifyOrgMembers(
  organizationId: string,
  input: {
    type: string;
    title: string;
    body: string;
    href?: string | null;
    metadata?: Record<string, unknown>;
    roles?: MemberRole[];
    /** Se true, omite operacionais (ex.: comissões). */
    mastersOnly?: boolean;
  },
) {
  const members = await firestoreDb.organizationMember.findMany({
    where: {
      organizationId,
      ...(input.mastersOnly
        ? { role: MemberRole.master }
        : input.roles
          ? { role: { in: input.roles } }
          : {}),
    },
    select: { userId: true },
  });

  if (members.length === 0) return [];

  return firestoreDb.$transaction(
    members.map((member) =>
      firestoreDb.notification.create({
        data: {
          userId: member.userId,
          organizationId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href ?? null,
          metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      }),
    ),
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  return firestoreDb.notification.count({
    where: { userId, readAt: null },
  });
}

export async function listNotifications(userId: string, take = 50) {
  return firestoreDb.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
