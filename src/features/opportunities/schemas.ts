import { z } from "zod";

export const declineInviteSchema = z.object({
  inviteId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const acceptInviteSchema = z.object({
  inviteId: z.string().min(1),
});

const conditionSchema = z.object({
  amountCents: z.number().int().positive("Valor deve ser maior que zero."),
  paymentTerms: z
    .string()
    .trim()
    .min(1, "Informe a condição de pagamento (ex.: à vista, 30 dias)."),
});

export const submitProposalSchema = z.object({
  inviteId: z.string().min(1),
  conditions: z.array(conditionSchema).min(1, "Informe ao menos uma condição."),
});
