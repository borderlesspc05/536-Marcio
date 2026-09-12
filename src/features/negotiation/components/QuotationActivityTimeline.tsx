export type ActivityItem = {
  id: string;
  at: string;
  kind: "status" | "message" | "approval";
  title: string;
  detail?: string;
};

type Props = {
  items: ActivityItem[];
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

export function QuotationActivityTimeline({ items }: Props) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
      <h2 className="text-lg font-semibold">Timeline de status</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Histórico de tratativas, mensagens, mudanças de status e aprovações.
      </p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Nenhum evento registrado ainda.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li key={item.id} className="flex gap-3 text-sm">
              <span
                className={
                  item.kind === "message"
                    ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9333EA]/15 text-xs font-bold text-[#9333EA]"
                    : item.kind === "approval"
                      ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700"
                      : "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9333EA] text-xs font-bold text-white"
                }
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">{item.title}</p>
                <p className="text-xs text-neutral-500">{formatWhen(item.at)}</p>
                {item.detail ? (
                  <p className="mt-1 whitespace-pre-wrap text-neutral-700">{item.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function buildQuotationActivityTimeline(input: {
  createdAt: Date | string;
  status: string;
  updatedAt?: Date | string | null;
  otherCompanyName?: string | null;
  messages: Array<{
    id: string;
    body: string;
    authorLabel: string;
    createdAt: Date | string;
  }>;
  approvedAt?: Date | string | null;
  approvedLabel?: string | null;
}): ActivityItem[] {
  const toIso = (value: Date | string) =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString();

  const items: ActivityItem[] = [
    {
      id: "status-aberta",
      at: toIso(input.createdAt),
      kind: "status",
      title: "Cotação aberta",
      detail: "Solicitação publicada para recebimento de propostas.",
    },
  ];

  const sortedMessages = [...input.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  if (sortedMessages.length > 0 || input.status === "em_negociacao") {
    items.push({
      id: "status-negociacao",
      at: toIso(sortedMessages[0]?.createdAt ?? input.updatedAt ?? input.createdAt),
      kind: "status",
      title: "Em negociação",
      detail: "Canal de tratativas aberto entre solicitante e fornecedor(es).",
    });
  }

  for (const message of sortedMessages) {
    items.push({
      id: `msg-${message.id}`,
      at: toIso(message.createdAt),
      kind: "message",
      title: `Mensagem — ${message.authorLabel}`,
      detail: message.body,
    });
  }

  const closedStatuses = ["aprovada", "recusada", "cancelada", "encerrada", "finalizada_outros"];
  if (closedStatuses.includes(input.status)) {
    const label =
      input.status === "finalizada_outros"
        ? `Finalizada — Outros${input.otherCompanyName ? `: ${input.otherCompanyName}` : ""}`
        : input.approvedLabel ??
          (input.status === "aprovada" ? "Proposta aprovada" : `Status: ${input.status.replace("_", " ")}`);
    items.push({
      id: `status-${input.status}`,
      at: toIso(input.approvedAt ?? input.updatedAt ?? input.createdAt),
      kind: "approval",
      title: label,
    });
  }

  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
