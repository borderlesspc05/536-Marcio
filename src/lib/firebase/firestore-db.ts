/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

type Relation = {
  model: string;
  many?: boolean;
  localKey?: string;
  foreignKey?: string;
  targetKey?: string;
};

const COLLECTIONS: Record<string, string> = {
  user: "users",
  organization: "organizations",
  organizationMember: "organization_members",
  plan: "plans",
  subscription: "subscriptions",
  planOverride: "plan_overrides",
  serviceCategory: "service_categories",
  organizationCategory: "organization_categories",
  complianceDocument: "compliance_documents",
  quotationInvite: "quotation_invites",
  proposal: "proposals",
  negotiationMessage: "negotiation_messages",
  favoriteSupplier: "favorite_suppliers",
  proposalCondition: "proposal_conditions",
  proposalConditionAttachment: "proposal_condition_attachments",
  serviceItem: "service_items",
  condominium: "condominiums",
  quotation: "quotations",
  serviceClient: "service_clients",
  serviceClientManager: "service_client_managers",
  rifAnalysis: "rif_analyses",
  quotationAttachment: "quotation_attachments",
  franchiseUsage: "franchise_usages",
  domainEvent: "domain_events",
  landingBanner: "landing_banners",
  marketingSettings: "marketing_settings",
  platformSettings: "platform_settings",
  notification: "notifications",
  emailOutbox: "email_outbox",
  reminderDispatch: "reminder_dispatches",
  paymentCheckout: "payment_checkouts",
  paymentWebhookEvent: "payment_webhook_events",
  subscriptionChange: "subscription_changes",
  organizationMigration: "organization_migrations",
  partnership: "partnerships",
  commissionAgreement: "commission_agreements",
  commissionEntry: "commission_entries",
  categoryAddonPurchase: "category_addon_purchases",
  emailToken: "email_tokens",
  externalApproverScope: "external_approver_scopes",
  quotationExternalApproval: "quotation_external_approvals",
  serviceAppointment: "service_appointments",
  passwordResetToken: "password_reset_tokens",
  consentRecord: "consent_records",
  auditLog: "audit_logs",
  referralReward: "referral_rewards",
};

const RELATIONS: Record<string, Record<string, Relation>> = {
  user: {
    memberships: { model: "organizationMember", many: true, foreignKey: "userId" },
    emailTokens: { model: "emailToken", many: true, foreignKey: "userId" },
    passwordResetTokens: { model: "passwordResetToken", many: true, foreignKey: "userId" },
    auditLogs: { model: "auditLog", many: true, foreignKey: "userId" },
    consentRecords: { model: "consentRecord", many: true, foreignKey: "userId" },
    referredBy: { model: "user", localKey: "referredByUserId" },
    referrals: { model: "user", many: true, foreignKey: "referredByUserId" },
    referralRewards: { model: "referralReward", many: true, foreignKey: "referrerUserId" },
    referredRewards: { model: "referralReward", many: true, foreignKey: "referredUserId" },
    notifications: { model: "notification", many: true, foreignKey: "userId" },
    externalApproverScopes: { model: "externalApproverScope", many: true, foreignKey: "userId" },
  },
  organization: {
    members: { model: "organizationMember", many: true, foreignKey: "organizationId" },
    subscriptions: { model: "subscription", many: true, foreignKey: "organizationId" },
    planOverrides: { model: "planOverride", many: true, foreignKey: "organizationId" },
    overrides: { model: "planOverride", many: true, foreignKey: "organizationId" },
    condominiums: { model: "condominium", many: true, foreignKey: "organizationId" },
    quotations: { model: "quotation", many: true, foreignKey: "organizationId" },
    categories: { model: "organizationCategory", many: true, foreignKey: "organizationId" },
    complianceDocuments: { model: "complianceDocument", many: true, foreignKey: "organizationId" },
    quotationInvites: { model: "quotationInvite", many: true, foreignKey: "supplierOrgId" },
    proposals: { model: "proposal", many: true, foreignKey: "organizationId" },
    favoriteSuppliers: { model: "favoriteSupplier", many: true, foreignKey: "ownerOrgId" },
    favoritedBy: { model: "favoriteSupplier", many: true, foreignKey: "supplierOrgId" },
    negotiationMessages: { model: "negotiationMessage", many: true, foreignKey: "organizationId" },
    partnershipsAsAdm: { model: "partnership", many: true, foreignKey: "admOrgId" },
    partnershipsAsSupplier: { model: "partnership", many: true, foreignKey: "supplierOrgId" },
    commissionAgreements: { model: "commissionAgreement", many: true, foreignKey: "admOrgId" },
    commissionAsSupplier: { model: "commissionAgreement", many: true, foreignKey: "supplierOrgId" },
  },
  organizationMember: {
    user: { model: "user", localKey: "userId" },
    organization: { model: "organization", localKey: "organizationId" },
  },
  plan: {
    subscriptions: { model: "subscription", many: true, foreignKey: "planId" },
    overrides: { model: "planOverride", many: true, foreignKey: "planId" },
    checkouts: { model: "paymentCheckout", many: true, foreignKey: "planId" },
  },
  subscription: {
    organization: { model: "organization", localKey: "organizationId" },
    plan: { model: "plan", localKey: "planId" },
    pendingPlan: { model: "plan", localKey: "pendingPlanId" },
  },
  planOverride: {
    organization: { model: "organization", localKey: "organizationId" },
    plan: { model: "plan", localKey: "planId" },
  },
  serviceCategory: {
    items: { model: "serviceItem", many: true, foreignKey: "categoryId" },
    quotations: { model: "quotation", many: true, foreignKey: "categoryId" },
    organizationLinks: { model: "organizationCategory", many: true, foreignKey: "categoryId" },
  },
  serviceItem: {
    category: { model: "serviceCategory", localKey: "categoryId" },
    quotations: { model: "quotation", many: true, foreignKey: "serviceItemId" },
  },
  organizationCategory: {
    organization: { model: "organization", localKey: "organizationId" },
    category: { model: "serviceCategory", localKey: "categoryId" },
  },
  complianceDocument: {
    organization: { model: "organization", localKey: "organizationId" },
    replaces: { model: "complianceDocument", localKey: "replacesId" },
    renewals: { model: "complianceDocument", many: true, foreignKey: "replacesId" },
  },
  condominium: {
    organization: { model: "organization", localKey: "organizationId" },
    quotations: { model: "quotation", many: true, foreignKey: "condominiumId" },
  },
  quotation: {
    organization: { model: "organization", localKey: "organizationId" },
    condominium: { model: "condominium", localKey: "condominiumId" },
    category: { model: "serviceCategory", localKey: "categoryId" },
    serviceItem: { model: "serviceItem", localKey: "serviceItemId" },
    serviceClient: { model: "serviceClient", localKey: "serviceClientId" },
    serviceManagedBy: { model: "organization", localKey: "serviceManagedByOrgId" },
    attachments: { model: "quotationAttachment", many: true, foreignKey: "quotationId" },
    invites: { model: "quotationInvite", many: true, foreignKey: "quotationId" },
    proposals: { model: "proposal", many: true, foreignKey: "quotationId" },
    rifAnalyses: { model: "rifAnalysis", many: true, foreignKey: "quotationId" },
    externalApproval: { model: "quotationExternalApproval", foreignKey: "quotationId" },
  },
  quotationInvite: {
    quotation: { model: "quotation", localKey: "quotationId" },
    supplier: { model: "organization", localKey: "supplierOrgId" },
    proposal: { model: "proposal", foreignKey: "inviteId" },
  },
  proposal: {
    invite: { model: "quotationInvite", localKey: "inviteId" },
    organization: { model: "organization", localKey: "organizationId" },
    quotation: { model: "quotation", localKey: "quotationId" },
    conditions: { model: "proposalCondition", many: true, foreignKey: "proposalId" },
    messages: { model: "negotiationMessage", many: true, foreignKey: "proposalId" },
  },
  proposalCondition: {
    proposal: { model: "proposal", localKey: "proposalId" },
    attachments: { model: "proposalConditionAttachment", many: true, foreignKey: "conditionId" },
  },
  proposalConditionAttachment: {
    condition: { model: "proposalCondition", localKey: "conditionId" },
  },
  negotiationMessage: {
    proposal: { model: "proposal", localKey: "proposalId" },
    organization: { model: "organization", localKey: "organizationId" },
  },
  favoriteSupplier: {
    owner: { model: "organization", localKey: "ownerOrgId" },
    supplier: { model: "organization", localKey: "supplierOrgId" },
    category: { model: "serviceCategory", localKey: "categoryId" },
  },
  serviceClient: {
    managedBy: { model: "organization", localKey: "managedByOrgId" },
    clientOrg: { model: "organization", localKey: "clientOrgId" },
    quotations: { model: "quotation", many: true, foreignKey: "serviceClientId" },
    managers: { model: "serviceClientManager", many: true, foreignKey: "serviceClientId" },
  },
  serviceClientManager: {
    serviceClient: { model: "serviceClient", localKey: "serviceClientId" },
  },
  rifAnalysis: {
    quotation: { model: "quotation", localKey: "quotationId" },
  },
  quotationAttachment: {
    quotation: { model: "quotation", localKey: "quotationId" },
  },
  franchiseUsage: {
    organization: { model: "organization", localKey: "organizationId" },
  },
  notification: {
    user: { model: "user", localKey: "userId" },
    organization: { model: "organization", localKey: "organizationId" },
  },
  paymentCheckout: {
    organization: { model: "organization", localKey: "organizationId" },
    plan: { model: "plan", localKey: "planId" },
  },
  organizationMigration: {
    organization: { model: "organization", localKey: "organizationId" },
    targetPlan: { model: "plan", localKey: "targetPlanId" },
    checkout: { model: "paymentCheckout", localKey: "checkoutId" },
  },
  partnership: {
    adm: { model: "organization", localKey: "admOrgId" },
    supplier: { model: "organization", localKey: "supplierOrgId" },
  },
  commissionAgreement: {
    adm: { model: "organization", localKey: "admOrgId" },
    supplier: { model: "organization", localKey: "supplierOrgId" },
    entries: { model: "commissionEntry", many: true, foreignKey: "agreementId" },
  },
  commissionEntry: {
    agreement: { model: "commissionAgreement", localKey: "agreementId" },
    adm: { model: "organization", localKey: "admOrgId" },
    supplier: { model: "organization", localKey: "supplierOrgId" },
    proposal: { model: "proposal", localKey: "proposalId" },
  },
  externalApproverScope: {
    user: { model: "user", localKey: "userId" },
    organization: { model: "organization", localKey: "organizationId" },
    condominium: { model: "condominium", localKey: "condominiumId" },
    serviceClient: { model: "serviceClient", localKey: "serviceClientId" },
  },
  quotationExternalApproval: {
    quotation: { model: "quotation", localKey: "quotationId" },
  },
  serviceAppointment: {
    organization: { model: "organization", localKey: "organizationId" },
    serviceClient: { model: "serviceClient", localKey: "serviceClientId" },
    condominium: { model: "condominium", localKey: "condominiumId" },
    category: { model: "serviceCategory", localKey: "categoryId" },
    serviceItem: { model: "serviceItem", localKey: "serviceItemId" },
    quotation: { model: "quotation", localKey: "quotationId" },
    externalApproval: { model: "quotationExternalApproval", localKey: "externalApprovalId" },
    createdBy: { model: "user", localKey: "createdByUserId" },
  },
  emailToken: { user: { model: "user", localKey: "userId" } },
  passwordResetToken: { user: { model: "user", localKey: "userId" } },
  consentRecord: { user: { model: "user", localKey: "userId" } },
  auditLog: { user: { model: "user", localKey: "userId" } },
  referralReward: {
    referrer: { model: "user", localKey: "referrerUserId" },
    referred: { model: "user", localKey: "referredUserId" },
  },
};

const DEFAULTS: Record<string, Record<string, unknown>> = {
  subscription: { status: "active", cancelAtPeriodEnd: false },
  serviceCategory: { colorToken: "neutral", sortOrder: 0, isActive: true },
  serviceItem: { isMandatory: false, sortOrder: 0, isActive: true },
  complianceDocument: { sizeBytes: 0, status: "em_analise" },
  quotationInvite: { status: "pendente", priorityTier: 4 },
  proposal: { status: "enviada" },
  quotation: { urgency: "media", minProposals: 3, maxProposals: 10, proposalsCount: 0, invitesPaused: false, status: "aberta", rifVisibleToClient: false },
  serviceClient: { isActive: true, solicitationLinkActive: true },
  franchiseUsage: { usedCount: 0 },
  landingBanner: { sortOrder: 0, isActive: true, showOnLanding: true, showInApp: true, scrollIntervalMs: 5500, audienceMode: "all", targetProfilesJson: "[]", targetUserIdsJson: "[]" },
  marketingSettings: { maxActiveBanners: 10 },
  notification: { readAt: null },
  paymentCheckout: { status: "pending", provider: "sandbox", quantity: 1, currency: "BRL", metadataJson: "{}" },
  partnership: { status: "active" },
  commissionEntry: { status: "expected" },
  referralReward: { kind: "recurring_credit", amountCents: 0 },
};

function collectionName(model: string): string {
  const name = COLLECTIONS[model];
  if (!name) throw new Error(`Coleção Firestore não mapeada: ${model}`);
  return name;
}

function fromFirestore(value: any): any {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fromFirestore(item)]));
  }
  return value;
}

function toFirestore(value: any): any {
  if (value === undefined) return undefined;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(toFirestore);
  if (value && typeof value === "object") {
    if ("increment" in value && Object.keys(value).length === 1) {
      return FieldValue.increment(Number(value.increment));
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, toFirestore(item)]),
    );
  }
  return value;
}

function comparable(value: any): any {
  return value instanceof Date ? value.getTime() : value;
}

function scalarMatches(value: any, condition: any): boolean {
  if (condition === null || typeof condition !== "object" || condition instanceof Date || Array.isArray(condition)) {
    return comparable(value) === comparable(condition);
  }
  if ("equals" in condition && !scalarMatches(value, condition.equals)) return false;
  if ("not" in condition && scalarMatches(value, condition.not)) return false;
  if ("in" in condition && !condition.in.some((item: any) => scalarMatches(value, item))) return false;
  if ("notIn" in condition && condition.notIn.some((item: any) => scalarMatches(value, item))) return false;
  if ("lt" in condition && !(comparable(value) < comparable(condition.lt))) return false;
  if ("lte" in condition && !(comparable(value) <= comparable(condition.lte))) return false;
  if ("gt" in condition && !(comparable(value) > comparable(condition.gt))) return false;
  if ("gte" in condition && !(comparable(value) >= comparable(condition.gte))) return false;
  const left = String(value ?? "");
  const normalize = (item: unknown) => condition.mode === "insensitive" ? String(item ?? "").toLowerCase() : String(item ?? "");
  const normalizedLeft = condition.mode === "insensitive" ? left.toLowerCase() : left;
  if ("contains" in condition && !normalizedLeft.includes(normalize(condition.contains))) return false;
  if ("startsWith" in condition && !normalizedLeft.startsWith(normalize(condition.startsWith))) return false;
  if ("endsWith" in condition && !normalizedLeft.endsWith(normalize(condition.endsWith))) return false;
  return true;
}

async function relationValue(model: string, record: any, relation: Relation): Promise<any> {
  const delegate = delegateFor(relation.model);
  if (relation.localKey) {
    const value = record[relation.localKey];
    if (value == null) return relation.many ? [] : null;
    return delegate.findFirst({ where: { [relation.targetKey ?? "id"]: value } });
  }
  const source = record.id;
  if (relation.many) return delegate.findMany({ where: { [relation.foreignKey!]: source } });
  return delegate.findFirst({ where: { [relation.foreignKey!]: source } });
}

async function matchesWhere(model: string, record: any, where?: Record<string, any>): Promise<boolean> {
  if (!where) return true;
  if (where.AND) {
    const items = Array.isArray(where.AND) ? where.AND : [where.AND];
    for (const item of items) if (!(await matchesWhere(model, record, item))) return false;
  }
  if (where.OR) {
    const items = Array.isArray(where.OR) ? where.OR : [where.OR];
    let matched = false;
    for (const item of items) if (await matchesWhere(model, record, item)) matched = true;
    if (!matched) return false;
  }
  if (where.NOT && await matchesWhere(model, record, where.NOT)) return false;

  for (const [key, condition] of Object.entries(where)) {
    if (["AND", "OR", "NOT"].includes(key)) continue;
    if (key.includes("_") && condition && typeof condition === "object" && !(key in record)) {
      for (const [compoundKey, compoundValue] of Object.entries(condition)) {
        if (!scalarMatches(record[compoundKey], compoundValue)) return false;
      }
      continue;
    }
    const relation = RELATIONS[model]?.[key];
    if (relation) {
      const related = await relationValue(model, record, relation);
      if (relation.many) {
        const list = related as any[];
        if (condition.some && !(await anyMatch(relation.model, list, condition.some))) return false;
        if (condition.none && await anyMatch(relation.model, list, condition.none)) return false;
        if (condition.every) {
          for (const item of list) if (!(await matchesWhere(relation.model, item, condition.every))) return false;
        }
      } else {
        const nested = condition?.is ?? condition;
        if (!related || !(await matchesWhere(relation.model, related, nested))) return false;
      }
      continue;
    }
    if (!scalarMatches(record[key], condition)) return false;
  }
  return true;
}

async function anyMatch(model: string, records: any[], where: any): Promise<boolean> {
  for (const record of records) if (await matchesWhere(model, record, where)) return true;
  return false;
}

function sortRecords(records: any[], orderBy?: any): any[] {
  if (!orderBy) return records;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return records.toSorted((left, right) => {
    for (const order of orders) {
      const [key, direction] = Object.entries(order)[0] as [string, any];
      const a = comparable(left[key]);
      const b = comparable(right[key]);
      if (a === b) continue;
      return (a == null ? -1 : b == null ? 1 : a < b ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
}

async function shapeRecord(model: string, record: any, args: any = {}): Promise<any> {
  if (!record) return record;
  const relationShape = args.include ?? args.select;
  const result: any = args.select ? {} : { ...record };

  if (args.select) {
    for (const [key, selection] of Object.entries(args.select)) {
      if (selection === true && key in record) result[key] = record[key];
    }
  }

  for (const [key, selection] of Object.entries(relationShape ?? {})) {
    if (!selection || key === "_count") continue;
    const relation = RELATIONS[model]?.[key];
    if (!relation) continue;
    const related = await relationValue(model, record, relation);
    const nestedArgs: any = selection === true ? {} : selection;
    if (relation.many) {
      let list = related as any[];
      if (nestedArgs.where) {
        const filtered: any[] = [];
        for (const item of list) if (await matchesWhere(relation.model, item, nestedArgs.where)) filtered.push(item);
        list = filtered;
      }
      list = sortRecords(list, nestedArgs.orderBy);
      if (nestedArgs.skip) list = list.slice(nestedArgs.skip);
      if (nestedArgs.take) list = list.slice(0, nestedArgs.take);
      result[key] = await Promise.all(list.map((item) => shapeRecord(relation.model, item, nestedArgs)));
    } else {
      result[key] = related ? await shapeRecord(relation.model, related, nestedArgs) : null;
    }
  }

  const countSelection = relationShape?._count;
  if (countSelection) {
    result._count = {};
    const selections: Record<string, any> = countSelection === true
      ? RELATIONS[model] ?? {}
      : countSelection.select ?? {};
    for (const [key, options] of Object.entries(selections)) {
      const relation = RELATIONS[model]?.[key];
      if (!relation) continue;
      let related = await relationValue(model, record, relation);
      const where = typeof options === "object" ? (options as any).where : undefined;
      if (where && Array.isArray(related)) {
        const filtered: any[] = [];
        for (const item of related) if (await matchesWhere(relation.model, item, where)) filtered.push(item);
        related = filtered;
      }
      result._count[key] = Array.isArray(related) ? related.length : related ? 1 : 0;
    }
  }
  return result;
}

async function allRecords(model: string): Promise<any[]> {
  const snapshot = await getAdminFirestore().collection(collectionName(model)).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...fromFirestore(doc.data()) }));
}

async function prepareCreate(model: string, input: any, forcedId?: string): Promise<any> {
  const id = forcedId ?? input.id ?? randomUUID();
  const now = new Date();
  const base: any = { ...DEFAULTS[model], id, ...input };
  if (!("createdAt" in base)) base.createdAt = now;
  if (!("updatedAt" in base)) base.updatedAt = now;

  const pendingMany: Array<{ relation: Relation; value: any }> = [];
  for (const [key, relation] of Object.entries(RELATIONS[model] ?? {})) {
    const nested = base[key];
    if (!nested || typeof nested !== "object") continue;
    delete base[key];
    if (relation.many) {
      pendingMany.push({ relation, value: nested });
    } else if (nested.connect) {
      if (relation.localKey) base[relation.localKey] = nested.connect[relation.targetKey ?? "id"];
    } else if (nested.create && relation.localKey) {
      const created = await delegateFor(relation.model).create({ data: nested.create });
      base[relation.localKey] = created[relation.targetKey ?? "id"];
    }
  }

  const document = { ...base };
  delete document.id;
  await getAdminFirestore().collection(collectionName(model)).doc(id).set(toFirestore(document));

  for (const pending of pendingMany) {
    const creates = pending.value.create ? (Array.isArray(pending.value.create) ? pending.value.create : [pending.value.create]) : [];
    for (const child of creates) {
      await delegateFor(pending.relation.model).create({
        data: { ...child, [pending.relation.foreignKey!]: id },
      });
    }
  }
  return { ...base, id };
}

function delegateFor(model: string) {
  return {
    async findMany(args: any = {}) {
      const records = await allRecords(model);
      const filtered: any[] = [];
      for (const record of records) if (await matchesWhere(model, record, args.where)) filtered.push(record);
      let result = sortRecords(filtered, args.orderBy);
      if (args.distinct) {
        const keys = Array.isArray(args.distinct) ? args.distinct : [args.distinct];
        const seen = new Set<string>();
        result = result.filter((item) => {
          const value = JSON.stringify(keys.map((key) => item[key]));
          if (seen.has(value)) return false;
          seen.add(value);
          return true;
        });
      }
      if (args.skip) result = result.slice(args.skip);
      if (args.take) result = result.slice(0, args.take);
      return Promise.all(result.map((record) => shapeRecord(model, record, args)));
    },
    async findFirst(args: any = {}) {
      const records = await this.findMany({ ...args, take: 1 });
      return records[0] ?? null;
    },
    async findUnique(args: any) {
      return this.findFirst(args);
    },
    async findUniqueOrThrow(args: any) {
      const result = await this.findUnique(args);
      if (!result) throw new Error(`${model} não encontrado.`);
      return result;
    },
    async findFirstOrThrow(args: any) {
      const result = await this.findFirst(args);
      if (!result) throw new Error(`${model} não encontrado.`);
      return result;
    },
    async create(args: any) {
      const created = await prepareCreate(model, args.data);
      return shapeRecord(model, created, args);
    },
    async createMany(args: any) {
      const values = Array.isArray(args.data) ? args.data : [args.data];
      let count = 0;
      for (const value of values) {
        if (args.skipDuplicates) {
          const id = value.id;
          if (id && await this.findUnique({ where: { id } })) continue;
        }
        await prepareCreate(model, value);
        count++;
      }
      return { count };
    },
    async update(args: any) {
      const current = await this.findUnique({ where: args.where });
      if (!current) throw new Error(`${model} não encontrado.`);
      const data: any = { ...args.data, updatedAt: new Date() };
      for (const [key, relation] of Object.entries(RELATIONS[model] ?? {})) {
        const nested = data[key];
        if (!nested || typeof nested !== "object") continue;
        delete data[key];
        if (!relation.many && nested.connect && relation.localKey) {
          data[relation.localKey] = nested.connect[relation.targetKey ?? "id"];
        }
      }
      await getAdminFirestore().collection(collectionName(model)).doc(current.id).update(toFirestore(data));
      return shapeRecord(model, { ...current, ...data }, args);
    },
    async updateMany(args: any) {
      const records = await this.findMany({ where: args.where });
      for (const record of records) await this.update({ where: { id: record.id }, data: args.data });
      return { count: records.length };
    },
    async delete(args: any) {
      const current = await this.findUnique({ where: args.where });
      if (!current) throw new Error(`${model} não encontrado.`);
      await getAdminFirestore().collection(collectionName(model)).doc(current.id).delete();
      return current;
    },
    async deleteMany(args: any = {}) {
      const records = await this.findMany({ where: args.where });
      for (const record of records) await getAdminFirestore().collection(collectionName(model)).doc(record.id).delete();
      return { count: records.length };
    },
    async upsert(args: any) {
      const current = await this.findUnique({ where: args.where });
      return current
        ? this.update({ where: { id: current.id }, data: args.update, ...pickShape(args) })
        : this.create({ data: { ...flattenUnique(args.where), ...args.create }, ...pickShape(args) });
    },
    async count(args: any = {}) {
      return (await this.findMany({ where: args.where })).length;
    },
    async aggregate(args: any = {}) {
      const records = await this.findMany({ where: args.where });
      const result: any = {};
      if (args._count) result._count = records.length;
      if (args._sum) {
        result._sum = {};
        for (const key of Object.keys(args._sum)) result._sum[key] = records.reduce((sum: number, item: any) => sum + Number(item[key] ?? 0), 0);
      }
      return result;
    },
    async groupBy(args: any) {
      const records = await this.findMany({ where: args.where });
      const by = Array.isArray(args.by) ? args.by : [args.by];
      const groups = new Map<string, any[]>();
      for (const record of records) {
        const key = JSON.stringify(by.map((field) => record[field]));
        groups.set(key, [...(groups.get(key) ?? []), record]);
      }
      const result = [...groups.values()].map((items) => {
        const row: any = Object.fromEntries(by.map((field) => [field, items[0][field]]));
        if (args._count) row._count = args._count === true ? items.length : Object.fromEntries(Object.keys(args._count).map((field) => [field, items.length]));
        if (args._sum) row._sum = Object.fromEntries(Object.keys(args._sum).map((field) => [field, items.reduce((sum, item) => sum + Number(item[field] ?? 0), 0)]));
        return row;
      });
      return sortRecords(result, args.orderBy);
    },
  };
}

function flattenUnique(where: any): any {
  const result: any = {};
  for (const [key, value] of Object.entries(where ?? {})) {
    if (key.includes("_") && value && typeof value === "object") Object.assign(result, value);
    else result[key] = value;
  }
  return result;
}

function pickShape(args: any) {
  return args.include ? { include: args.include } : args.select ? { select: args.select } : {};
}

const delegates = new Map<string, ReturnType<typeof delegateFor>>();

export const firestoreDb: any = new Proxy(
  {
    async $disconnect() {
      // O Admin SDK gerencia seu próprio pool de conexões.
    },
    async $transaction(input: any) {
      if (typeof input === "function") return input(firestoreDb);
      return Promise.all(input);
    },
  },
  {
    get(target, property: string) {
      if (property in target) return (target as any)[property];
      if (!delegates.has(property)) delegates.set(property, delegateFor(property));
      return delegates.get(property);
    },
  },
);
