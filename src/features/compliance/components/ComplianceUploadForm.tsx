"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadComplianceDocumentAction } from "@/features/compliance/actions";

const DOC_TYPES = [
  "Certidão Negativa Federal",
  "Certidão Negativa Estadual",
  "Certidão Negativa Municipal",
  "FGTS",
  "INSS",
  "Alvará de funcionamento",
  "Contrato social",
  "CREA",
  "Outro",
];

const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  replacesId?: string;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComplianceUploadForm({ replacesId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setDragging] = useState(false);

  function assignFile(next: File | null) {
    if (next && next.size > MAX_BYTES) {
      setError("Arquivo deve ter no máximo 10MB.");
      return;
    }
    setError(null);
    setFile(next);
    if (fileRef.current) {
      if (!next) {
        fileRef.current.value = "";
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(next);
      fileRef.current.files = transfer.files;
    }
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-5"
      action={(formData) => {
        startTransition(async () => {
          if (!file) {
            setError("Selecione um arquivo para anexar.");
            setMessage(null);
            return;
          }
          const result = await uploadComplianceDocumentAction(formData);
          if (!result.ok) {
            setError(result.message ?? "Erro no upload");
            setMessage(null);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Enviado com sucesso.");
          assignFile(null);
          router.refresh();
        });
      }}
    >
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          {replacesId ? "Renovar documento" : "Enviar documento"}
        </h2>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Você pode enviar vários documentos (certidões, contrato social, CREA, etc.). A validade de
          6 meses começa automaticamente na aprovação pela plataforma.
        </p>
      </div>

      {replacesId ? <input type="hidden" name="replacesId" value={replacesId} /> : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-neutral-800">Tipo do documento</span>
        <select
          name="documentType"
          required
          className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Selecione o tipo
          </option>
          {DOC_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-neutral-800">Anexo do documento</span>
        <input
          ref={fileRef}
          type="file"
          name="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(event) => assignFile(event.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) assignFile(dropped);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            isDragging
              ? "border-[#c10089] bg-[#FFF7FB]"
              : file
                ? "border-emerald-300 bg-emerald-50/70"
                : "border-black/15 bg-neutral-50 hover:border-[#c10089]/50 hover:bg-[#FFF7FB]"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c10089]/10 text-[#c10089]">
            <FileUp className="h-6 w-6" aria-hidden />
          </span>
          {file ? (
            <>
              <span className="text-sm font-semibold text-neutral-900">Arquivo selecionado</span>
              <span className="max-w-full truncate px-2 text-sm text-emerald-800">{file.name}</span>
              <span className="text-xs text-neutral-500">{formatBytes(file.size)} · clique para trocar</span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-neutral-900">
                Arraste o arquivo aqui ou clique para anexar
              </span>
              <span className="text-xs text-neutral-500">PDF, JPG ou PNG · máx. 10MB</span>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[#c10089] px-3 py-1.5 text-xs font-bold text-white">
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                Escolher arquivo
              </span>
            </>
          )}
        </button>

        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900">{file.name}</p>
              <p className="text-xs text-neutral-500">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-700"
              aria-label="Remover arquivo"
              onClick={() => assignFile(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Nenhum arquivo anexado ainda.</p>
        )}
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar documento"}
      </Button>
    </form>
  );
}
