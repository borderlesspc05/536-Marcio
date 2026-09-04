/**
 * Tipos do domínio CotaCondo.
 *
 * Estes tipos são independentes do mecanismo de persistência. Firestore é o
 * adapter oficial; nenhuma camada da aplicação deve depender de tipos gerados
 * por ORM.
 */

export const OrganizationType = { fornecedor: "fornecedor", sindico: "sindico", administradora: "administradora", master_admin: "master_admin", master_service: "master_service" } as const;
export type OrganizationType = (typeof OrganizationType)[keyof typeof OrganizationType];
export const ServicePipelineStatus = { em_liberacao: "em_liberacao", em_andamento: "em_andamento", em_negociacao: "em_negociacao", em_analise: "em_analise", recusada: "recusada", aprovada: "aprovada" } as const;
export type ServicePipelineStatus = (typeof ServicePipelineStatus)[keyof typeof ServicePipelineStatus];
export const RifAnalysisStatus = { draft: "draft", published: "published" } as const;
export type RifAnalysisStatus = (typeof RifAnalysisStatus)[keyof typeof RifAnalysisStatus];
export const ServiceAiApiMode = { platform: "platform", client: "client" } as const;
export type ServiceAiApiMode = (typeof ServiceAiApiMode)[keyof typeof ServiceAiApiMode];
export const MemberRole = { master: "master", operational: "operational", external_approver: "external_approver" } as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];
export const AppointmentLeadMode = { exact_date: "exact_date", days_15: "days_15", days_30: "days_30", days_60: "days_60", days_90: "days_90" } as const;
export type AppointmentLeadMode = (typeof AppointmentLeadMode)[keyof typeof AppointmentLeadMode];
export const AppointmentSource = { approval: "approval", manual: "manual" } as const;
export type AppointmentSource = (typeof AppointmentSource)[keyof typeof AppointmentSource];
export const PlanAudience = { solicitante: "solicitante", fornecedor: "fornecedor", platform: "platform" } as const;
export type PlanAudience = (typeof PlanAudience)[keyof typeof PlanAudience];
export const SubscriptionStatus = { pending: "pending", paid: "paid", active: "active", failed: "failed", canceled: "canceled", past_due: "past_due" } as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const QuotationStatus = { aberta: "aberta", em_negociacao: "em_negociacao", aprovada: "aprovada", recusada: "recusada", cancelada: "cancelada", encerrada: "encerrada", finalizada_outros: "finalizada_outros" } as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];
export const QuotationUrgency = { baixa: "baixa", media: "media", alta: "alta", critica: "critica" } as const;
export type QuotationUrgency = (typeof QuotationUrgency)[keyof typeof QuotationUrgency];
export const ComplianceStatus = { aprovado: "aprovado", em_analise: "em_analise", em_atraso: "em_atraso", negada: "negada" } as const;
export type ComplianceStatus = (typeof ComplianceStatus)[keyof typeof ComplianceStatus];
export const InviteStatus = { pendente: "pendente", aceito: "aceito", declinado: "declinado", expirado: "expirado" } as const;
export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus];
export const SupplierPipelineStage = { nova: "nova", em_andamento: "em_andamento", proposta_enviada: "proposta_enviada", negociacao: "negociacao", ganha: "ganha", perdida: "perdida" } as const;
export type SupplierPipelineStage = (typeof SupplierPipelineStage)[keyof typeof SupplierPipelineStage];
export const ProposalStatus = { enviada: "enviada", em_negociacao: "em_negociacao", aprovada: "aprovada", recusada: "recusada" } as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];
export const BannerAudienceMode = { all: "all", profiles: "profiles", users: "users" } as const;
export type BannerAudienceMode = (typeof BannerAudienceMode)[keyof typeof BannerAudienceMode];
export const CheckoutKind = { plan: "plan", category_addon: "category_addon", migration: "migration", custom: "custom" } as const;
export type CheckoutKind = (typeof CheckoutKind)[keyof typeof CheckoutKind];
export const CheckoutStatus = { pending: "pending", paid: "paid", failed: "failed", canceled: "canceled", expired: "expired" } as const;
export type CheckoutStatus = (typeof CheckoutStatus)[keyof typeof CheckoutStatus];
export const PartnershipStatus = { active: "active", blocked: "blocked", ended: "ended" } as const;
export type PartnershipStatus = (typeof PartnershipStatus)[keyof typeof PartnershipStatus];
export const MigrationStatus = { pending_payment: "pending_payment", pending_review: "pending_review", approved: "approved", rejected: "rejected", canceled: "canceled" } as const;
export type MigrationStatus = (typeof MigrationStatus)[keyof typeof MigrationStatus];
export const CommissionFeeType = { fixed: "fixed", percent: "percent" } as const;
export type CommissionFeeType = (typeof CommissionFeeType)[keyof typeof CommissionFeeType];
export const CommissionEntryStatus = { expected: "expected", accrued: "accrued", paid: "paid", canceled: "canceled" } as const;
export type CommissionEntryStatus = (typeof CommissionEntryStatus)[keyof typeof CommissionEntryStatus];
export const ReferralRewardKind = { recurring_credit: "recurring_credit", discount: "discount", commission_share: "commission_share" } as const;
export type ReferralRewardKind = (typeof ReferralRewardKind)[keyof typeof ReferralRewardKind];

export type Plan = {
  id: string;
  slug: string;
  name: string;
  audience: PlanAudience;
  isFree: boolean;
  monthlyQuota: number | null;
  priceCents: number;
  featuresJson: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Subscription = {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  startsAt: Date;
  endsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanId: string | null;
};
