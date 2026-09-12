import type { ReactNode } from "react";
import type { ServiceOpsSnapshot } from "@/features/master-service/ops-status";
import { ATTENTION_LABELS } from "@/features/master-service/ops-status";

function chipClass(tone: "neutral" | "amber" | "emerald" | "magenta" | "cyan") {
  switch (tone) {
    case "amber":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "emerald":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "magenta":
      return "bg-[#FFF7FB] text-[#9a006e] ring-[#c10089]/25";
    case "cyan":
      return "bg-[#F0FDFA] text-[#0f766e] ring-[#00aab3]/30";
    default:
      return "bg-neutral-50 text-neutral-700 ring-black/10";
  }
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "amber" | "emerald" | "magenta" | "cyan";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${chipClass(tone)}`}
    >
      {children}
    </span>
  );
}

export function ServiceOpsChips({
  ops,
  compact = false,
}: {
  ops: ServiceOpsSnapshot;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-1"}`}>
      <Chip tone="cyan">
        {ops.proposalCount} proposta{ops.proposalCount === 1 ? "" : "s"}
      </Chip>
      <Chip tone={ops.hasPublishedRif ? "emerald" : ops.hasDraftRif ? "amber" : "neutral"}>
        {ops.rifLabel}
      </Chip>
      <Chip tone={ops.hasMasterAccept ? "emerald" : "neutral"}>
        {ops.hasMasterAccept ? "Aceite Master" : "Sem Aceite Master"}
      </Chip>
      {ops.contactReleased || ops.isApproved ? (
        <Chip tone="emerald">Contato liberado</Chip>
      ) : null}
      {!compact && ops.attention !== "aguardar" && ops.attention !== "fechada" ? (
        <Chip tone="magenta">{ATTENTION_LABELS[ops.attention]}</Chip>
      ) : null}
    </div>
  );
}

export function ServiceOpsNextStep({ ops }: { ops: ServiceOpsSnapshot }) {
  return (
    <div className="rounded-xl border border-[#c10089]/20 bg-[#FFF7FB] px-3 py-2 text-sm text-[#9a006e]">
      <span className="font-semibold">Próximo passo:</span> {ops.nextStep}
    </div>
  );
}
