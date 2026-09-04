import { firestoreDb } from "../src/lib/firebase/firestore-db";
import {
  DISTRIBUTION_TIERS,
  runDistributionEngine,
  pauseQuotationInvitesIfMaxReached,
  emitMinProposalsIfReached,
} from "../src/features/distribution/engine";

async function main() {
  const sindico = await firestoreDb.organization.findFirst({ where: { type: "sindico" } });
  const adm = await firestoreDb.organization.findFirst({ where: { type: "administradora" } });
  const user = await firestoreDb.user.findFirst({ where: { email: "sindico@demo.cotacondo.com.br" } });
  if (!sindico || !user) throw new Error("Seed base ausente");

  const category = await firestoreDb.serviceCategory.findFirst({
    where: { slug: "seguros", deletedAt: null },
  });
  const service = await firestoreDb.serviceItem.findFirst({
    where: { categoryId: category!.id, deletedAt: null },
  });
  const condo = await firestoreDb.condominium.findFirst({
    where: { organizationId: sindico.id, archivedAt: null },
  });
  if (!category || !service || !condo) throw new Error("Categoria/serviço/condo ausentes");

  const quotation = await firestoreDb.quotation.create({
    data: {
      publicId: `COT-D4-${Date.now()}`,
      organizationId: sindico.id,
      condominiumId: condo.id,
      categoryId: category.id,
      serviceItemId: service.id,
      urgency: "media",
      description: "Smoke Dia 4 — distribuição e metas.",
      minProposals: 1,
      maxProposals: 2,
      status: "aberta",
      createdByUserId: user.id,
    },
  });

  const distribution = await runDistributionEngine(quotation.id);
  console.log("Distribuição:", distribution.invited.map((i) => `${i.tier}:${i.reason}`));

  if (distribution.invited.length < 1) {
    throw new Error("Motor deveria convidar ao menos 1 fornecedor com categoria seguros");
  }

  const tiers = distribution.invited.map((item) => item.tier);
  for (let i = 1; i < tiers.length; i += 1) {
    if (tiers[i]! < tiers[i - 1]!) {
      throw new Error("Prioridade fora de ordem (tier menor deve vir antes)");
    }
  }
  console.log("Ordem de prioridade OK");

  // Simula propostas até a máxima
  const invites = await firestoreDb.quotationInvite.findMany({
    where: { quotationId: quotation.id },
    take: 2,
  });

  for (const invite of invites) {
    await firestoreDb.$transaction(async (tx) => {
      await tx.quotationInvite.update({
        where: { id: invite.id },
        data: { status: "aceito", acceptedAt: new Date() },
      });
      const proposal = await tx.proposal.create({
        data: {
          inviteId: invite.id,
          organizationId: invite.supplierOrgId,
          quotationId: quotation.id,
          status: "enviada",
          createdByUserId: user.id,
          conditions: {
            create: [
              { amountCents: 100000, paymentTerms: "30 dias", sortOrder: 0 },
              { amountCents: 95000, paymentTerms: "à vista", sortOrder: 1 },
            ],
          },
        },
        include: { conditions: true },
      });
      await tx.quotation.update({
        where: { id: quotation.id },
        data: { proposalsCount: { increment: 1 } },
      });
      return proposal;
    });
  }

  await emitMinProposalsIfReached(quotation.id);
  const paused = await pauseQuotationInvitesIfMaxReached(quotation.id);
  if (!paused) throw new Error("Meta máxima deveria pausar convites");

  const refreshed = await firestoreDb.quotation.findUniqueOrThrow({ where: { id: quotation.id } });
  if (!refreshed.invitesPaused || refreshed.proposalsCount < refreshed.maxProposals) {
    throw new Error("Cotação deveria estar pausada na meta máxima");
  }
  console.log("Meta máxima / pause OK");

  const proposals = await firestoreDb.proposal.findMany({
    where: { quotationId: quotation.id },
    include: { conditions: true },
  });
  const winner = proposals[0]!;
  const condition = winner.conditions[0]!;

  await firestoreDb.$transaction(async (tx) => {
    await tx.proposal.update({ where: { id: winner.id }, data: { status: "aprovada" } });
    await tx.proposal.updateMany({
      where: { quotationId: quotation.id, id: { not: winner.id } },
      data: { status: "recusada" },
    });
    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        status: "aprovada",
        approvedProposalId: winner.id,
        approvedConditionId: condition.id,
      },
    });
  });

  const afterApprove = await firestoreDb.proposal.findMany({ where: { quotationId: quotation.id } });
  const approved = afterApprove.filter((item) => item.status === "aprovada");
  const rejected = afterApprove.filter((item) => item.status === "recusada");
  if (approved.length !== 1 || rejected.length !== afterApprove.length - 1) {
    throw new Error("Aprovar deveria recusar as demais");
  }
  console.log("Aprovar / rejeitar demais OK");

  // Outros em cotação separada
  const quotationOthers = await firestoreDb.quotation.create({
    data: {
      publicId: `COT-D4-OUT-${Date.now()}`,
      organizationId: sindico.id,
      condominiumId: condo.id,
      categoryId: category.id,
      serviceItemId: service.id,
      urgency: "baixa",
      description: "Smoke Outros",
      minProposals: 1,
      maxProposals: 3,
      status: "aberta",
      createdByUserId: user.id,
    },
  });
  await firestoreDb.quotation.update({
    where: { id: quotationOthers.id },
    data: {
      status: "finalizada_outros",
      invitesPaused: true,
      otherCompanyName: "Empresa Externa Smoke",
      otherFinalAmountCents: 250000,
    },
  });
  const others = await firestoreDb.quotation.findUniqueOrThrow({ where: { id: quotationOthers.id } });
  if (!others.otherCompanyName || !others.otherFinalAmountCents) {
    throw new Error("Outros deveria persistir empresa e valor");
  }
  console.log("Fluxo Outros OK");

  if (adm) {
    const favorite = await firestoreDb.favoriteSupplier.findFirst({
      where: { organizationId: adm.id },
    });
    if (!favorite) {
      console.warn("Aviso: favorito Adm não encontrado no seed (ok se seed incompleto)");
    } else {
      console.log("Favorito Adm Premium OK");
    }
  }

  console.log("Tiers:", DISTRIBUTION_TIERS);
  console.log("SMOKE DIA 4 OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
