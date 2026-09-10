import {
  MemberRole,
  OrganizationType,
  PlanAudience,
} from "../src/lib/domain/types";
import bcrypt from "bcryptjs";
import { firestoreDb } from "../src/lib/firebase/firestore-db";

async function upsertUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  return firestoreDb.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      passwordHash: input.passwordHash,
      emailVerifiedAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
    create: {
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      emailVerifiedAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
  });
}

async function ensureOrgMembership(input: {
  userId: string;
  organizationId: string;
  role: MemberRole;
}) {
  await firestoreDb.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: input.userId,
        organizationId: input.organizationId,
      },
    },
    update: { role: input.role },
    create: {
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role,
    },
  });
}

async function ensureActiveSubscription(organizationId: string, planSlug: string) {
  const plan = await firestoreDb.plan.findUniqueOrThrow({ where: { slug: planSlug } });
  const existing = await firestoreDb.subscription.findFirst({
    where: { organizationId, status: "active" },
  });
  if (!existing) {
    await firestoreDb.subscription.create({
      data: { organizationId, planId: plan.id, status: "active" },
    });
  }
}

async function main() {
  await firestoreDb.platformSettings.upsert({
    where: { id: "default" },
    update: {
      freeQuotaSolicitante: 15,
      freeQuotaFornecedor: 1,
      supplierProQuota: 30,
      supplierPremiumQuota: 100,
      reminderDaysJson: "[5,10]",
      partnershipLockEnabled: true,
      categoryAddonPriceCents: 2900,
    },
    create: {
      id: "default",
      freeQuotaSolicitante: 15,
      freeQuotaFornecedor: 1,
      supplierProQuota: 30,
      supplierPremiumQuota: 100,
      reminderDaysJson: "[5,10]",
      partnershipLockEnabled: true,
      categoryAddonPriceCents: 2900,
    },
  });

  await firestoreDb.marketingSettings.upsert({
    where: { id: "default" },
    update: {
      whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "https://wa.me/5500000000000",
      blogUrl: process.env.NEXT_PUBLIC_BLOG_URL ?? "https://blog.cotacondo.com.br",
    },
    create: {
      id: "default",
      whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "https://wa.me/5500000000000",
      blogUrl: process.env.NEXT_PUBLIC_BLOG_URL ?? "https://blog.cotacondo.com.br",
    },
  });

  const banners = [
    {
      id: "banner_cotacoes",
      title: "Cotações profissionais para condomínios",
      imageUrl: "/brand/banners/01-cotacoes.svg",
      linkUrl: "/#planos",
      sortOrder: 1,
      isActive: true,
      showOnLanding: true,
      showInApp: true,
      audienceMode: "all" as const,
      targetProfilesJson: "[]",
      targetUserIdsJson: "[]",
    },
    {
      id: "banner_fornecedores",
      title: "Fornecedores: oportunidades com compliance",
      imageUrl: "/brand/banners/02-fornecedores.svg",
      linkUrl: "/fornecedores",
      sortOrder: 2,
      isActive: true,
      showOnLanding: true,
      showInApp: true,
      audienceMode: "all" as const,
      targetProfilesJson: "[]",
      targetUserIdsJson: "[]",
    },
    {
      id: "banner_premium",
      title: "Administradora Premium: parcerias e comissões",
      imageUrl: "/brand/banners/03-compliance.svg",
      linkUrl: "/checkout?plan=adm-premium",
      sortOrder: 3,
      isActive: true,
      showOnLanding: true,
      showInApp: true,
      audienceMode: "all" as const,
      targetProfilesJson: "[]",
      targetUserIdsJson: "[]",
    },
  ];

  for (const banner of banners) {
    await firestoreDb.landingBanner.upsert({
      where: { id: banner.id },
      update: banner,
      create: banner,
    });
  }
  const plans = [
    {
      slug: "sindico-free",
      name: "Cota Free",
      description: "Até 15 cotações para começar com governança.",
      audience: PlanAudience.solicitante,
      isFree: true,
      monthlyQuota: 15,
      priceCents: 0,
      sortOrder: 10,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({ whitelabel: false }),
    },
    {
      slug: "sindico-pago",
      name: "Cota Basic",
      description: "Escala a operação com os recursos do Free e adicionais.",
      audience: PlanAudience.solicitante,
      isFree: false,
      monthlyQuota: 50,
      priceCents: 39990,
      sortOrder: 20,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({ whitelabel: true }),
    },
    {
      slug: "adm-free",
      name: "Administradora Free",
      description: "Entrada gratuita (migração bloqueada)",
      audience: PlanAudience.solicitante,
      isFree: true,
      monthlyQuota: 15,
      priceCents: 0,
      sortOrder: 30,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({ whitelabel: true, partnerships: false }),
    },
    {
      slug: "adm-pago",
      name: "Administradora Intermediária",
      description: "Plano pago intermediário para migração e operação",
      audience: PlanAudience.solicitante,
      isFree: false,
      monthlyQuota: 80,
      priceCents: 39990,
      sortOrder: 40,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({
        whitelabel: true,
        partnerships: false,
        favorites: false,
        commissions: false,
        sla: false,
      }),
    },
    {
      slug: "adm-premium",
      name: "Cota Premium",
      description: "Operação completa de administradora com gestão de ponta a ponta.",
      audience: PlanAudience.solicitante,
      isFree: false,
      monthlyQuota: null,
      priceCents: 68990,
      sortOrder: 50,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({
        whitelabel: true,
        partnerships: true,
        favorites: true,
        commissions: true,
        sla: true,
      }),
    },
    {
      slug: "cota-service",
      name: "Cota Service",
      description:
        "Cotação gerenciada de ponta a ponta pela equipe CotaCondo (sob consulta).",
      audience: PlanAudience.solicitante,
      isFree: false,
      monthlyQuota: null,
      priceCents: 0,
      sortOrder: 55,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({
        whitelabel: true,
        partnerships: true,
        favorites: true,
        commissions: false,
        sla: true,
        cotaService: true,
        rif: true,
        managedQuotation: true,
      }),
    },
    {
      slug: "fornecedor-free",
      name: "Condo Free",
      description: "5 cotações internas/mês e 1 categoria",
      audience: PlanAudience.fornecedor,
      isFree: true,
      monthlyQuota: 5,
      priceCents: 0,
      sortOrder: 60,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({ categoriesIncluded: 1, crm: false }),
    },
    {
      slug: "fornecedor-pro",
      name: "Condo Basic",
      description: "Elegível a parcerias · 3 categorias · CRM",
      audience: PlanAudience.fornecedor,
      isFree: false,
      monthlyQuota: 30,
      priceCents: 14900,
      sortOrder: 70,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({
        categoriesIncluded: 3,
        partnershipEligible: true,
        crm: true,
      }),
    },
    {
      slug: "fornecedor-premium",
      name: "Condo Premium",
      description: "CRM + até 5 categorias + parcerias",
      audience: PlanAudience.fornecedor,
      isFree: false,
      monthlyQuota: 150,
      priceCents: 24900,
      sortOrder: 80,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({
        categoriesIncluded: 5,
        crm: true,
        partnershipEligible: true,
      }),
    },
    {
      slug: "fornecedor-vip",
      name: "Plano VIP",
      description: "Banner patrocinado e campanhas sob relacionamento comercial",
      audience: PlanAudience.fornecedor,
      isFree: false,
      monthlyQuota: null,
      priceCents: 0,
      sortOrder: 90,
      billingInterval: "monthly",
      featuresJson: JSON.stringify({
        categoriesIncluded: 5,
        crm: true,
        partnershipEligible: true,
        vip: true,
      }),
    },
  ];

  for (const plan of plans) {
    const payload = { ...plan, isActive: true };
    await firestoreDb.plan.upsert({
      where: { slug: plan.slug },
      update: payload,
      create: payload,
    });
  }

  const passwordHash = await bcrypt.hash("123456", 12);

  const platformOrg = await firestoreDb.organization.upsert({
    where: { id: "org_platform_master" },
    update: { name: "CotaCondo Plataforma", type: OrganizationType.master_admin },
    create: {
      id: "org_platform_master",
      name: "CotaCondo Plataforma",
      type: OrganizationType.master_admin,
    },
  });

  const sindicoOrg = await firestoreDb.organization.upsert({
    where: { id: "org_demo_sindico" },
    update: { name: "Condomínio Demo Sol", type: OrganizationType.sindico },
    create: {
      id: "org_demo_sindico",
      name: "Condomínio Demo Sol",
      type: OrganizationType.sindico,
    },
  });

  const fornecedorOrg = await firestoreDb.organization.upsert({
    where: { id: "org_demo_fornecedor" },
    update: { name: "Serviços Prediais Demo LTDA", type: OrganizationType.fornecedor },
    create: {
      id: "org_demo_fornecedor",
      name: "Serviços Prediais Demo LTDA",
      type: OrganizationType.fornecedor,
    },
  });

  const admOrg = await firestoreDb.organization.upsert({
    where: { id: "org_demo_adm" },
    update: { name: "Administradora Premium Demo", type: OrganizationType.administradora },
    create: {
      id: "org_demo_adm",
      name: "Administradora Premium Demo",
      type: OrganizationType.administradora,
    },
  });

  const masterServiceOrg = await firestoreDb.organization.upsert({
    where: { id: "org_master_service" },
    update: { name: "CotaCondo Master Service", type: OrganizationType.master_service },
    create: {
      id: "org_master_service",
      name: "CotaCondo Master Service",
      type: OrganizationType.master_service,
    },
  });

  const demos = [
    {
      email: "admin@cotacondo.com.br",
      name: "Master Admin",
      organizationId: platformOrg.id,
      role: MemberRole.master,
      planSlug: "sindico-free",
    },
    {
      email: "masterservice@demo.cotacondo.com.br",
      name: "Master Service Demo",
      organizationId: masterServiceOrg.id,
      role: MemberRole.master,
      planSlug: "cota-service",
    },
    {
      email: "sindico@demo.cotacondo.com.br",
      name: "Síndico Demo",
      organizationId: sindicoOrg.id,
      role: MemberRole.master,
      planSlug: "sindico-free",
    },
    {
      email: "fornecedor@demo.cotacondo.com.br",
      name: "Fornecedor Demo",
      organizationId: fornecedorOrg.id,
      role: MemberRole.master,
      planSlug: "fornecedor-free",
    },
    {
      email: "adm.master@demo.cotacondo.com.br",
      name: "Adm Master Demo",
      organizationId: admOrg.id,
      role: MemberRole.master,
      planSlug: "adm-premium",
    },
    {
      email: "adm.operacional@demo.cotacondo.com.br",
      name: "Adm Operacional Demo",
      organizationId: admOrg.id,
      role: MemberRole.operational,
      planSlug: "adm-premium",
    },
  ] as const;

  for (const demo of demos) {
    const user = await upsertUser({
      email: demo.email,
      name: demo.name,
      passwordHash,
    });
    await ensureOrgMembership({
      userId: user.id,
      organizationId: demo.organizationId,
      role: demo.role,
    });
    await ensureActiveSubscription(demo.organizationId, demo.planSlug);

    const existingConsent = await firestoreDb.consentRecord.findFirst({
      where: { userId: user.id, type: "privacy_policy" },
    });
    if (!existingConsent) {
      await firestoreDb.consentRecord.create({
        data: {
          userId: user.id,
          type: "privacy_policy",
          accepted: true,
        },
      });
    }
  }

  const { seedOfficialCatalog } = await import("../src/features/catalog/seed");
  const catalog = await seedOfficialCatalog();
  console.log(`Catálogo seed: ${catalog.categoryCount} categorias / ${catalog.itemCount} serviços`);

  const segurosCategory = await firestoreDb.serviceCategory.findUnique({
    where: { slug: "seguros" },
    include: { items: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const segurosSegment = segurosCategory?.items[0];
  if (segurosCategory && segurosSegment) {
    await firestoreDb.organizationCategory.deleteMany({
      where: { organizationId: fornecedorOrg.id, categoryId: segurosCategory.id },
    });
    await firestoreDb.organizationCategory.create({
      data: {
        organizationId: fornecedorOrg.id,
        categoryId: segurosCategory.id,
        serviceItemId: segurosSegment.id,
        isIncluded: true,
        contactName: "Comercial Seguros Demo",
        contactEmail: "fornecedor@demo.cotacondo.com.br",
      },
    });
  }

  // Fornecedores extras para o motor de distribuição (Dia 4)
  const fornecedorPro = await firestoreDb.organization.upsert({
    where: { id: "org_demo_fornecedor_pro" },
    update: { name: "Seguros Pro Compliant LTDA", type: OrganizationType.fornecedor },
    create: {
      id: "org_demo_fornecedor_pro",
      name: "Seguros Pro Compliant LTDA",
      type: OrganizationType.fornecedor,
      document: "12345678000199",
    },
  });
  const fornecedorPending = await firestoreDb.organization.upsert({
    where: { id: "org_demo_fornecedor_pending" },
    update: { name: "Seguros Pending Docs LTDA", type: OrganizationType.fornecedor },
    create: {
      id: "org_demo_fornecedor_pending",
      name: "Seguros Pending Docs LTDA",
      type: OrganizationType.fornecedor,
      document: "98765432000111",
    },
  });

  await ensureActiveSubscription(fornecedorPro.id, "fornecedor-pro");
  await ensureActiveSubscription(fornecedorPending.id, "fornecedor-pro");

  if (segurosCategory && segurosSegment) {
    for (const orgId of [fornecedorPro.id, fornecedorPending.id]) {
      await firestoreDb.organizationCategory.deleteMany({
        where: { organizationId: orgId, categoryId: segurosCategory.id },
      });
      await firestoreDb.organizationCategory.create({
        data: {
          organizationId: orgId,
          categoryId: segurosCategory.id,
          serviceItemId: segurosSegment.id,
          isIncluded: true,
        },
      });
    }

    await firestoreDb.complianceDocument.deleteMany({
      where: { organizationId: { in: [fornecedorPro.id, fornecedorPending.id] } },
    });
    await firestoreDb.complianceDocument.create({
      data: {
        organizationId: fornecedorPro.id,
        documentType: "Certidão Negativa Federal",
        fileName: "cnd-pro.pdf",
        storagePath: "local://uploads/cnd-pro.pdf",
        validUntil: new Date(Date.now() + 180 * 86400000),
        status: "aprovado",
      },
    });
    await firestoreDb.complianceDocument.create({
      data: {
        organizationId: fornecedorPending.id,
        documentType: "Certidão Negativa Federal",
        fileName: "cnd-pending.pdf",
        storagePath: "local://uploads/cnd-pending.pdf",
        validUntil: new Date(Date.now() + 180 * 86400000),
        status: "em_analise",
      },
    });

    await firestoreDb.favoriteSupplier.upsert({
      where: {
        organizationId_supplierOrgId: {
          organizationId: admOrg.id,
          supplierOrgId: fornecedorPro.id,
        },
      },
      update: { categoryId: segurosCategory.id },
      create: {
        organizationId: admOrg.id,
        supplierOrgId: fornecedorPro.id,
        categoryId: segurosCategory.id,
      },
    });
  }

  const condo = await firestoreDb.condominium.upsert({
    where: { id: "condo_demo_sol" },
    update: {
      name: "Residencial Sol Demo",
      address: "Rua das Palmeiras, 100 — São Paulo/SP",
      organizationId: sindicoOrg.id,
      archivedAt: null,
    },
    create: {
      id: "condo_demo_sol",
      organizationId: sindicoOrg.id,
      name: "Residencial Sol Demo",
      address: "Rua das Palmeiras, 100 — São Paulo/SP",
      document: "11222333000181",
      contactName: "Síndico Demo",
      contactEmail: "sindico@demo.cotacondo.com.br",
    },
  });

  const serviceItem = segurosCategory
    ? await firestoreDb.serviceItem.findFirst({
        where: { categoryId: segurosCategory.id, deletedAt: null, isActive: true },
        orderBy: { sortOrder: "asc" },
      })
    : null;

  if (segurosCategory && serviceItem) {
    const quotation = await firestoreDb.quotation.upsert({
      where: { publicId: "COT-DEMO-000001" },
      update: {
        description: "Cotação demo para oportunidades do fornecedor (Dia 3).",
        status: "aberta",
      },
      create: {
        publicId: "COT-DEMO-000001",
        organizationId: sindicoOrg.id,
        condominiumId: condo.id,
        categoryId: segurosCategory.id,
        serviceItemId: serviceItem.id,
        urgency: "media",
        description: "Cotação demo para oportunidades do fornecedor (Dia 3).",
        minProposals: 3,
        maxProposals: 10,
        status: "aberta",
        createdByUserId: (
          await firestoreDb.user.findUniqueOrThrow({
            where: { email: "sindico@demo.cotacondo.com.br" },
          })
        ).id,
      },
    });

    await firestoreDb.quotationInvite.upsert({
      where: {
        quotationId_supplierOrgId: {
          quotationId: quotation.id,
          supplierOrgId: fornecedorOrg.id,
        },
      },
      update: { status: "pendente", declineReason: null, declinedAt: null },
      create: {
        quotationId: quotation.id,
        supplierOrgId: fornecedorOrg.id,
        status: "pendente",
      },
    });

    const quotation2 = await firestoreDb.quotation.upsert({
      where: { publicId: "COT-DEMO-000002" },
      update: {
        description: "Segunda oportunidade demo (Kanban).",
        status: "aberta",
      },
      create: {
        publicId: "COT-DEMO-000002",
        organizationId: sindicoOrg.id,
        condominiumId: condo.id,
        categoryId: segurosCategory.id,
        serviceItemId: serviceItem.id,
        urgency: "alta",
        description: "Segunda oportunidade demo (Kanban).",
        minProposals: 2,
        maxProposals: 8,
        status: "aberta",
        createdByUserId: (
          await firestoreDb.user.findUniqueOrThrow({
            where: { email: "sindico@demo.cotacondo.com.br" },
          })
        ).id,
      },
    });

    await firestoreDb.quotationInvite.upsert({
      where: {
        quotationId_supplierOrgId: {
          quotationId: quotation2.id,
          supplierOrgId: fornecedorOrg.id,
        },
      },
      update: { status: "pendente", declineReason: null, declinedAt: null },
      create: {
        quotationId: quotation2.id,
        supplierOrgId: fornecedorOrg.id,
        status: "pendente",
      },
    });
  }

  const serviceClient = await firestoreDb.serviceClient.upsert({
    where: { clientOrgId: admOrg.id },
    update: {
      managedByOrgId: masterServiceOrg.id,
      displayName: "Administradora Premium Demo",
      primaryColor: "#7C3AED",
      secondaryColor: "#0D9488",
      solicitationLinkSlug: "adm-premium-demo",
      solicitationLinkActive: true,
      isActive: true,
      aiApiMode: "platform",
    },
    create: {
      id: "service_client_adm_demo",
      managedByOrgId: masterServiceOrg.id,
      clientOrgId: admOrg.id,
      displayName: "Administradora Premium Demo",
      primaryColor: "#7C3AED",
      secondaryColor: "#0D9488",
      solicitationLinkSlug: "adm-premium-demo",
      solicitationLinkActive: true,
      isActive: true,
      aiApiMode: "platform",
      paymentLinkUrl: "https://pay.cotacondo.com.br/demo-cota-service",
    },
  });

  await firestoreDb.serviceClientManager.upsert({
    where: {
      serviceClientId_email: {
        serviceClientId: serviceClient.id,
        email: "adm.master@demo.cotacondo.com.br",
      },
    },
    update: {
      name: "Adm Master Demo",
      roleLabel: "gerente",
      userId: (
        await firestoreDb.user.findUniqueOrThrow({
          where: { email: "adm.master@demo.cotacondo.com.br" },
        })
      ).id,
    },
    create: {
      serviceClientId: serviceClient.id,
      userId: (
        await firestoreDb.user.findUniqueOrThrow({
          where: { email: "adm.master@demo.cotacondo.com.br" },
        })
      ).id,
      name: "Adm Master Demo",
      email: "adm.master@demo.cotacondo.com.br",
      roleLabel: "gerente",
    },
  });

  const admCondo = await firestoreDb.condominium.upsert({
    where: { id: "condo_demo_adm_service" },
    update: {
      name: "Residencial Aurora Service",
      address: "Av. Paulista, 1000 — São Paulo/SP",
      organizationId: admOrg.id,
      archivedAt: null,
    },
    create: {
      id: "condo_demo_adm_service",
      organizationId: admOrg.id,
      name: "Residencial Aurora Service",
      address: "Av. Paulista, 1000 — São Paulo/SP",
      document: "44555666000177",
      contactName: "Gerente Operacional",
      contactEmail: "adm.operacional@demo.cotacondo.com.br",
      contactPhone: "11999990000",
    },
  });

  if (segurosCategory && serviceItem) {
    const serviceMasterUser = await firestoreDb.user.findUniqueOrThrow({
      where: { email: "masterservice@demo.cotacondo.com.br" },
    });

    const serviceQuotation = await firestoreDb.quotation.upsert({
      where: { publicId: "COT-SERVICE-000001" },
      update: {
        description: "Cotação Cota Service demo — aguardando liberação do Master Service.",
        serviceClientId: serviceClient.id,
        serviceManagedByOrgId: masterServiceOrg.id,
        servicePipelineStatus: "em_liberacao",
        requesterName: "Carla Operacional",
        requesterEmail: "adm.operacional@demo.cotacondo.com.br",
        requesterPhone: "11999990000",
        requesterRole: "Assistente de compras",
        invitesPaused: true,
      },
      create: {
        publicId: "COT-SERVICE-000001",
        organizationId: admOrg.id,
        condominiumId: admCondo.id,
        categoryId: segurosCategory.id,
        serviceItemId: serviceItem.id,
        urgency: "alta",
        description: "Cotação Cota Service demo — aguardando liberação do Master Service.",
        minProposals: 3,
        maxProposals: 8,
        status: "aberta",
        invitesPaused: true,
        createdByUserId: serviceMasterUser.id,
        serviceClientId: serviceClient.id,
        serviceManagedByOrgId: masterServiceOrg.id,
        servicePipelineStatus: "em_liberacao",
        requesterName: "Carla Operacional",
        requesterEmail: "adm.operacional@demo.cotacondo.com.br",
        requesterPhone: "11999990000",
        requesterRole: "Assistente de compras",
      },
    });

    await firestoreDb.quotationInvite.upsert({
      where: {
        quotationId_supplierOrgId: {
          quotationId: serviceQuotation.id,
          supplierOrgId: fornecedorOrg.id,
        },
      },
      update: { status: "pendente" },
      create: {
        quotationId: serviceQuotation.id,
        supplierOrgId: fornecedorOrg.id,
        status: "pendente",
        priorityTier: 2,
        selectionReason: "Cota Service — base CotaCondo",
      },
    });

    const approverUser = await upsertUser({
      email: "aprovador@demo.cotacondo.com.br",
      name: "Síndico Aprovador Demo",
      passwordHash,
    });
    await ensureOrgMembership({
      userId: approverUser.id,
      organizationId: admOrg.id,
      role: MemberRole.external_approver,
    });
    await firestoreDb.externalApproverScope.upsert({
      where: {
        userId_condominiumId: {
          userId: approverUser.id,
          condominiumId: admCondo.id,
        },
      },
      update: {
        organizationId: admOrg.id,
        serviceClientId: serviceClient.id,
      },
      create: {
        userId: approverUser.id,
        organizationId: admOrg.id,
        condominiumId: admCondo.id,
        serviceClientId: serviceClient.id,
      },
    });

    const pendingApprovalQuotation = await firestoreDb.quotation.upsert({
      where: { publicId: "COT-SERVICE-000002" },
      update: {
        servicePipelineStatus: "em_analise",
        masterAcceptedAt: new Date(),
        rifVisibleToClient: true,
        status: "em_negociacao",
      },
      create: {
        publicId: "COT-SERVICE-000002",
        organizationId: admOrg.id,
        condominiumId: admCondo.id,
        categoryId: segurosCategory.id,
        serviceItemId: serviceItem.id,
        urgency: "media",
        description: "Cotação aguardando aprovação do síndico externo.",
        minProposals: 2,
        maxProposals: 6,
        status: "em_negociacao",
        createdByUserId: serviceMasterUser.id,
        serviceClientId: serviceClient.id,
        serviceManagedByOrgId: masterServiceOrg.id,
        servicePipelineStatus: "em_analise",
        masterAcceptedAt: new Date(),
        rifVisibleToClient: true,
        requesterName: "Carla Operacional",
        requesterEmail: "adm.operacional@demo.cotacondo.com.br",
        requesterRole: "Assistente de compras",
      },
    });

    const winningInvite = await firestoreDb.quotationInvite.upsert({
      where: {
        quotationId_supplierOrgId: {
          quotationId: pendingApprovalQuotation.id,
          supplierOrgId: fornecedorOrg.id,
        },
      },
      update: { status: "aceito", supplierPipelineStage: "proposta_enviada" },
      create: {
        quotationId: pendingApprovalQuotation.id,
        supplierOrgId: fornecedorOrg.id,
        status: "aceito",
        supplierPipelineStage: "proposta_enviada",
      },
    });

    const winningProposal = await firestoreDb.proposal.upsert({
      where: { inviteId: winningInvite.id },
      update: { status: "em_negociacao" },
      create: {
        inviteId: winningInvite.id,
        organizationId: fornecedorOrg.id,
        quotationId: pendingApprovalQuotation.id,
        status: "em_negociacao",
        createdByUserId: (
          await firestoreDb.user.findUniqueOrThrow({
            where: { email: "fornecedor@demo.cotacondo.com.br" },
          })
        ).id,
      },
    });

    await firestoreDb.proposalCondition.deleteMany({ where: { proposalId: winningProposal.id } });
    await firestoreDb.proposalCondition.create({
      data: {
        proposalId: winningProposal.id,
        amountCents: 1890000,
        paymentTerms: "30 dias após execução",
      },
    });

    await firestoreDb.quotation.update({
      where: { id: pendingApprovalQuotation.id },
      data: { approvedProposalId: winningProposal.id, proposalsCount: 1 },
    });

    await firestoreDb.rifAnalysis.deleteMany({ where: { quotationId: pendingApprovalQuotation.id } });
    await firestoreDb.rifAnalysis.create({
      data: {
        quotationId: pendingApprovalQuotation.id,
        generatedByUserId: serviceMasterUser.id,
        status: "published",
        averageCents: 1890000,
        summaryMarkdown:
          "## Análise RIF\n\nProposta única dentro da média esperada para o segmento.",
        comparativeJson: JSON.stringify([
          {
            proposalId: winningProposal.id,
            supplierName: "Fornecedor Demo",
            amountCents: 1890000,
            paymentTerms: "30 dias após execução",
            vsAverage: "na_media",
            deltaPercent: 0,
          },
        ]),
      },
    });

    const nextAppointment = new Date();
    nextAppointment.setMonth(nextAppointment.getMonth() + 4);
    await firestoreDb.serviceAppointment.upsert({
      where: { id: "appointment_demo_adm" },
      update: {
        appointmentDate: nextAppointment,
        organizationId: admOrg.id,
        serviceClientId: serviceClient.id,
        condominiumId: admCondo.id,
        categoryId: segurosCategory.id,
        serviceItemId: serviceItem.id,
      },
      create: {
        id: "appointment_demo_adm",
        organizationId: admOrg.id,
        serviceClientId: serviceClient.id,
        condominiumId: admCondo.id,
        categoryId: segurosCategory.id,
        serviceItemId: serviceItem.id,
        appointmentDate: nextAppointment,
        leadMode: "days_30",
        source: "manual",
        createdByUserId: (
          await firestoreDb.user.findUniqueOrThrow({
            where: { email: "adm.master@demo.cotacondo.com.br" },
          })
        ).id,
        notes: "Demo — dedetização anual",
      },
    });
  }

  console.log("Seed concluído. Senha das contas demo: 123456");
  for (const demo of demos) {
    console.log(` - ${demo.email}`);
  }
  console.log(" - aprovador@demo.cotacondo.com.br (Aprovador Externo)");
  console.log("Sincronize o Firebase Auth com: npm run seed:firebase-auth");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
