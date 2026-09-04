import { firestoreDb } from "@/lib/firebase/firestore-db";

export type EmailTemplate =
  | "min_proposals_reached"
  | "quotation_invite"
  | "reminder_solicitante"
  | "reminder_fornecedor"
  | "quotation_approved"
  | "quotation_outros"
  | "compliance_updated"
  | "generic";

export type SendEmailInput = {
  toEmail: string;
  subject: string;
  bodyText: string;
  template: EmailTemplate | string;
  metadata?: Record<string, unknown>;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<{ id: string; status: string }>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput) {
    const row = await firestoreDb.emailOutbox.create({
      data: {
        toEmail: input.toEmail,
        subject: input.subject,
        bodyText: input.bodyText,
        template: input.template,
        status: "sent",
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        sentAt: new Date(),
      },
    });
    if (process.env.NEXT_PUBLIC_APP_ENV !== "production") {
      console.log(`[email:${input.template}] → ${input.toEmail}: ${input.subject}`);
    }
    return { id: row.id, status: row.status };
  }
}

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(input: SendEmailInput) {
    const queued = await firestoreDb.emailOutbox.create({
      data: {
        toEmail: input.toEmail,
        subject: input.subject,
        bodyText: input.bodyText,
        template: input.template,
        status: "queued",
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "CotaCondo <onboarding@resend.dev>",
          to: [input.toEmail],
          subject: input.subject,
          text: input.bodyText,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend HTTP ${response.status}`);
      }
      await firestoreDb.emailOutbox.update({
        where: { id: queued.id },
        data: { status: "sent", sentAt: new Date() },
      });
      return { id: queued.id, status: "sent" };
    } catch (error) {
      await firestoreDb.emailOutbox.update({
        where: { id: queued.id },
        data: {
          status: "failed",
          metadataJson: JSON.stringify({
            ...(input.metadata ?? {}),
            error: String(error),
          }),
        },
      });
      throw error;
    }
  }
}

export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  if (key) return new ResendEmailProvider(key);
  return new ConsoleEmailProvider();
}

export async function sendTemplatedEmail(input: SendEmailInput) {
  return getEmailProvider().send(input);
}
