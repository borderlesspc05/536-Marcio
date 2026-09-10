"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  GripVertical,
  Loader2,
} from "lucide-react";
import { moveSupplierOpportunityAction } from "@/features/opportunities/actions";
import {
  SUPPLIER_PIPELINE_META,
  SUPPLIER_PIPELINE_STAGES,
  type SupplierPipelineStageValue,
} from "@/features/opportunities/pipeline";

export type SupplierKanbanCard = {
  id: string;
  publicId: string;
  description: string;
  categoryName: string;
  serviceName: string;
  condominiumName: string;
  urgency: string;
  createdAt: string;
  proposalValue: string | null;
  proposalValueCents: number | null;
  officialStatus: string;
  stage: SupplierPipelineStageValue;
};

type SupplierKanbanBoardProps = {
  initialCards: SupplierKanbanCard[];
};

const OFFICIAL_STATUS_LABELS: Record<string, string> = {
  pendente: "Convite pendente",
  aceito: "Convite aceito",
  declinado: "Convite declinado",
  expirado: "Convite expirado",
  enviada: "Proposta enviada",
  em_negociacao: "Em negociação",
  aprovada: "Proposta aprovada",
  recusada: "Proposta recusada",
};

const URGENCY_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const CARD_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

export function SupplierKanbanBoard({ initialCards }: SupplierKanbanBoardProps) {
  const [cards, setCards] = useState(initialCards);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null,
  );
  const [, startTransition] = useTransition();

  function moveCard(inviteId: string, nextStage: SupplierPipelineStageValue) {
    const current = cards.find((card) => card.id === inviteId);
    if (!current || current.stage === nextStage || movingId) return;

    const previousStage = current.stage;
    setFeedback(null);
    setMovingId(inviteId);
    setCards((items) =>
      items.map((card) => (card.id === inviteId ? { ...card, stage: nextStage } : card)),
    );

    startTransition(async () => {
      const result = await moveSupplierOpportunityAction({ inviteId, stage: nextStage });
      if (!result.ok) {
        setCards((items) =>
          items.map((card) =>
            card.id === inviteId ? { ...card, stage: previousStage } : card,
          ),
        );
        setFeedback({
          kind: "error",
          message: result.message ?? "Não foi possível mover a oportunidade.",
        });
      } else {
        setFeedback({ kind: "success", message: "Etapa salva." });
      }
      setMovingId(null);
    });
  }

  return (
    <section aria-label="Funil de oportunidades">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-800">Organize seu processo comercial</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Arraste os cartões entre as colunas. A etapa interna fica salva sem alterar o status
            oficial da proposta.
          </p>
        </div>
        {feedback ? (
          <p
            role="status"
            className={`w-fit rounded-lg px-3 py-1.5 text-xs font-medium ${
              feedback.kind === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {feedback.message}
          </p>
        ) : (
          <p className="text-xs text-neutral-400">Também funciona pelo seletor de etapa</p>
        )}
      </div>

      <div className="grid auto-cols-[286px] grid-flow-col gap-3 overflow-x-auto pb-4 xl:auto-cols-[minmax(250px,1fr)]">
        {SUPPLIER_PIPELINE_STAGES.map((stage) => {
          const meta = SUPPLIER_PIPELINE_META[stage];
          const stageCards = cards.filter((card) => card.stage === stage);
          const stageTotalCents = stageCards.reduce(
            (sum, card) => sum + (card.proposalValueCents ?? 0),
            0,
          );

          return (
            <div
              key={stage}
              className={`min-h-[420px] rounded-2xl border border-black/[0.06] p-3 ${meta.surface}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const inviteId = event.dataTransfer.getData("text/plain") || draggedId;
                if (inviteId) moveCard(inviteId, stage);
                setDraggedId(null);
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-2 px-1">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${meta.accent}`} />
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">{meta.label}</h2>
                    <p className="mt-0.5 text-[11px] text-neutral-500">{meta.description}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#00aab3]">
                      Total etapa:{" "}
                      {(stageTotalCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  </div>
                </div>
                <span className="rounded-lg bg-white/80 px-2 py-1 text-xs font-bold text-neutral-600 shadow-sm">
                  {stageCards.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {stageCards.map((card) => (
                  <article
                    key={card.id}
                    draggable={movingId !== card.id}
                    onDragStart={(event) => {
                      setDraggedId(card.id);
                      event.dataTransfer.setData("text/plain", card.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    className={`group rounded-xl border bg-white p-3.5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.55)] transition ${
                      draggedId === card.id
                        ? "border-[#9333EA]/40 opacity-60"
                        : "border-black/[0.07] hover:-translate-y-0.5 hover:border-[#9333EA]/25 hover:shadow-[0_14px_30px_-22px_rgba(126,34,206,0.65)]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-neutral-300 group-hover:text-neutral-500"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-neutral-900">{card.publicId}</p>
                            <p className="mt-0.5 text-xs font-medium text-[#7E22CE]">
                              {card.categoryName}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-400">
                              {card.serviceName}
                            </p>
                          </div>
                          {movingId === card.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#9333EA]" />
                          ) : null}
                        </div>

                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-600">
                          {card.description}
                        </p>

                        <div className="mt-3 space-y-1.5 text-[11px] text-neutral-500">
                          <p className="flex items-center gap-1.5 truncate">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{card.condominiumName}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            {CARD_DATE_FORMAT.format(new Date(card.createdAt))}
                            <span className="text-neutral-300">|</span>
                            Urgência {URGENCY_LABELS[card.urgency] ?? card.urgency}
                          </p>
                          {card.proposalValue ? (
                            <p className="flex items-center gap-1.5 font-semibold text-neutral-700">
                              <CircleDollarSign className="h-3.5 w-3.5 shrink-0" />
                              {card.proposalValue}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.05] pt-3">
                          <span className="truncate text-[10px] font-medium text-neutral-400">
                            {OFFICIAL_STATUS_LABELS[card.officialStatus] ?? card.officialStatus}
                          </span>
                          <Link
                            href={`/app/oportunidades?view=lista&inviteId=${card.id}`}
                            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#7E22CE] hover:text-[#6B21A8]"
                            draggable={false}
                          >
                            Abrir
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>

                        <label className="mt-3 block text-[10px] font-semibold text-neutral-400">
                          Mover para
                          <select
                            value={card.stage}
                            disabled={movingId !== null}
                            onChange={(event) =>
                              moveCard(
                                card.id,
                                event.target.value as SupplierPipelineStageValue,
                              )
                            }
                            className="mt-1.5 h-9 w-full rounded-lg border border-black/10 bg-white px-2 text-xs font-medium text-neutral-700 outline-none transition focus:border-[#9333EA]/40 focus:ring-2 focus:ring-[#9333EA]/10 disabled:opacity-50"
                          >
                            {SUPPLIER_PIPELINE_STAGES.map((option) => (
                              <option key={option} value={option}>
                                {SUPPLIER_PIPELINE_META[option].label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </article>
                ))}

                {stageCards.length === 0 ? (
                  <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-black/10 bg-white/40 px-4 text-center text-xs leading-5 text-neutral-400">
                    Arraste uma oportunidade para esta etapa
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
