"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { reviewComplianceDocumentAction } from "@/features/compliance/actions";

type QueueItem = {
  id: string;
  documentType: string;
  fileName: string;
  storagePath: string;
  contentType: string | null;
  sizeBytes: number;
  validUntil: string;
  status: string;
  createdAt: string;
  organizationName: string;
  organizationDocument: string | null;
};

type Props = { queue: QueueItem[] };

function daysLabel(validUntilIso: string) {
  const days = Math.ceil(
    (new Date(validUntilIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return `${Math.abs(days)} dia(s) vencido(s)`;
  if (days === 0) return "vence hoje";
  return `${days} dia(s) restantes`;
}

export function ComplianceQueueClient({ queue }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  function review(documentId: string, decision: "aprovado" | "negada", notes: string) {
    const formData = new FormData();
    formData.set("documentId", documentId);
    formData.set("decision", decision);
    if (notes) formData.set("reviewNotes", notes);
    startTransition(async () => {
      const result = await reviewComplianceDocumentAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        setMessage(null);
        return;
      }
      setError(null);
      setMessage(result.message ?? "Salvo com sucesso.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {queue.map((doc) => {
        const viewHref = `/api/app/files?path=${encodeURIComponent(doc.storagePath)}&name=${encodeURIComponent(doc.fileName)}&inline=1`;
        const downloadHref = `/api/app/files?path=${encodeURIComponent(doc.storagePath)}&name=${encodeURIComponent(doc.fileName)}`;
        const isPdf =
          (doc.contentType || "").includes("pdf") || doc.fileName.toLowerCase().endsWith(".pdf");

        return (
          <div key={doc.id} className="rounded-2xl border border-black/5 bg-white/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">{doc.documentType}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {doc.organizationName}
                  {doc.organizationDocument ? ` · CNPJ/CPF ${doc.organizationDocument}` : ""}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  Arquivo: <span className="font-medium">{doc.fileName}</span> ·{" "}
                  {Math.round(doc.sizeBytes / 1024)} KB
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Validade {new Date(doc.validUntil).toLocaleDateString("pt-BR")} ·{" "}
                  {daysLabel(doc.validUntil)} · Status {doc.status} · Enviado{" "}
                  {new Date(doc.createdAt).toLocaleDateString("pt-BR")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={viewHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-xl border border-[#c10089]/25 bg-[#FFF7FB] px-3 text-sm font-semibold text-[#9a006e]"
                  >
                    Ver em tela
                  </a>
                  <a
                    href={downloadHref}
                    className="inline-flex h-9 items-center rounded-xl border border-black/10 px-3 text-sm font-semibold text-neutral-700"
                  >
                    Baixar
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewId(previewId === doc.id ? null : doc.id)}
                  >
                    {previewId === doc.id ? "Ocultar prévia" : "Prévia na página"}
                  </Button>
                </div>
                {previewId === doc.id && isPdf ? (
                  <iframe
                    title={doc.fileName}
                    src={viewHref}
                    className="mt-4 h-[420px] w-full rounded-xl border border-black/10 bg-white"
                  />
                ) : null}
                {previewId === doc.id && !isPdf ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewHref}
                    alt={doc.fileName}
                    className="mt-4 max-h-[420px] w-full rounded-xl border border-black/10 object-contain"
                  />
                ) : null}
              </div>

              <div className="flex w-full max-w-md flex-col gap-2 sm:w-auto">
                <input
                  id={`notes-${doc.id}`}
                  name="reviewNotes"
                  placeholder="Nota (opcional)"
                  className="h-10 rounded-xl border border-black/10 px-3 text-sm"
                  disabled={pending}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const notes =
                        (document.getElementById(`notes-${doc.id}`) as HTMLInputElement | null)
                          ?.value ?? "";
                      review(doc.id, "aprovado", notes);
                    }}
                  >
                    {pending ? "..." : "Aprovar"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      const notes =
                        (document.getElementById(`notes-${doc.id}`) as HTMLInputElement | null)
                          ?.value || "Documento rejeitado";
                      review(doc.id, "negada", notes);
                    }}
                  >
                    Rejeitar
                  </Button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Ao aprovar: notifica o fornecedor e inicia validade de 180 dias (6 meses). Lembrete
                  automático 5 dias antes do vencimento.
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {queue.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-neutral-500">
          Nenhuma pendência na fila.
        </p>
      ) : null}
    </div>
  );
}
