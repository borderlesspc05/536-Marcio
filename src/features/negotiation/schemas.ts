import { z } from "zod";

export const negotiateSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1, "Selecione ao menos uma proposta."),
  message: z.string().trim().min(2, "Escreva uma mensagem para iniciar a negociação."),
});

export const negotiationMessageSchema = z.object({
  proposalId: z.string().min(1),
  body: z.string().trim().min(1, "Mensagem vazia."),
});

export const negotiationMessagesBulkSchema = z.object({
  proposalIds: z.array(z.string().min(1)).min(1, "Selecione ao menos uma proposta."),
  body: z.string().trim().min(1, "Mensagem vazia."),
});

export const approveConditionSchema = z.object({
  proposalId: z.string().min(1),
  conditionId: z.string().min(1),
});

export const approveOthersSchema = z.object({
  quotationId: z.string().min(1),
  companyName: z.string().trim().min(2, "Informe o nome da empresa."),
  finalAmount: z.coerce.number().positive("Informe o valor final."),
});

export const updateProposalConditionsSchema = z.object({
  proposalId: z.string().min(1),
  conditions: z
    .array(
      z.object({
        amountCents: z.number().int().positive(),
        paymentTerms: z.string().trim().min(2),
      }),
    )
    .min(1),
});
