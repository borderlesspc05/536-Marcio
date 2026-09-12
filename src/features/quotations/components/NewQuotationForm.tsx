"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createQuotationAction } from "@/features/quotations/actions";

type Option = { id: string; name: string; categoryId?: string; isMandatory?: boolean; periodicityHint?: string | null };

type Props = {
  condominiums: Option[];
  categories: Option[];
  services: Option[];
  canCreate: boolean;
  franchiseLabel: string;
};

const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewQuotationForm({ condominiums, categories, services, canCreate, franchiseLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [serviceItemId, setServiceItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function syncFiles(next: File[]) {
    const limited = next.slice(0, MAX_ATTACHMENTS);
    setFiles(limited);
    if (fileInputRef.current) {
      const transfer = new DataTransfer();
      for (const file of limited) transfer.items.add(file);
      fileInputRef.current.files = transfer.files;
    }
  }

  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming);
    const oversized = list.find((file) => file.size > MAX_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" excede 10MB.`);
      return;
    }
    const merged = [...files];
    for (const file of list) {
      if (merged.length >= MAX_ATTACHMENTS) break;
      if (merged.some((item) => item.name === file.name && item.size === file.size)) continue;
      merged.push(file);
    }
    setError(null);
    syncFiles(merged);
  }

  const filteredServices = useMemo(
    () => services.filter((item) => item.categoryId === categoryId),
    [services, categoryId],
  );

  const selectedService = filteredServices.find((item) => item.id === serviceItemId);

  return (
    <form
      className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-6"
      action={(formData) => {
        startTransition(async () => {
          const result = await createQuotationAction(formData);
          if (!result.ok) {
            setError(result.message ?? "Não foi possível criar a cotação.");
            return;
          }
          router.push(`/app/cotacoes/${result.quotationId}`);
          router.refresh();
        });
      }}
    >
      <div className="rounded-xl bg-fuchsia-50 px-4 py-3 text-sm text-[#7c3aed]">
        Franquia do mês: <strong>{franchiseLabel}</strong>
      </div>

      {!canCreate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Limite de cotações atingido. Faça upgrade do plano para continuar abrindo cotações.
          <div className="mt-2">
            <a href="/app/configuracoes" className="font-semibold underline">
              Ver planos / upgrade
            </a>
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium">Condomínio</label>
        <select
          name="condominiumId"
          required
          disabled={!canCreate}
          className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
        >
          <option value="">Selecione...</option>
          {condominiums.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Categoria (mãe)</label>
          <select
            name="categoryId"
            required
            disabled={!canCreate}
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setServiceItemId("");
            }}
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Segmento</label>
          <select
            name="serviceItemId"
            required
            disabled={!canCreate}
            value={serviceItemId}
            onChange={(event) => setServiceItemId(event.target.value)}
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="">Selecione...</option>
            {filteredServices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedService?.isMandatory || selectedService?.periodicityHint ? (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {selectedService.isMandatory ? <strong>Serviço obrigatório. </strong> : null}
          {selectedService.periodicityHint
            ? `Periodicidade sugerida: ${selectedService.periodicityHint}.`
            : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Urgência</label>
          <select
            name="urgency"
            defaultValue="media"
            disabled={!canCreate}
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Propostas mínimas</label>
          <input
            name="minProposals"
            type="number"
            min={1}
            defaultValue={3}
            disabled={!canCreate}
            className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Propostas máximas</label>
          <input
            name="maxProposals"
            type="number"
            min={1}
            defaultValue={10}
            disabled={!canCreate}
            className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Descrição detalhada</label>
        <textarea
          name="description"
          required
          rows={5}
          disabled={!canCreate}
          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
          placeholder="Descreva escopo, prazos e restrições..."
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Anexos</label>
        <input
          ref={fileInputRef}
          name="attachments"
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
        <input
          ref={pickerRef}
          type="file"
          multiple
          disabled={!canCreate}
          className="sr-only"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip"
          onChange={(event) => {
            if (event.target.files?.length) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={!canCreate || files.length >= MAX_ATTACHMENTS}
          onClick={() => pickerRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            if (canCreate) setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (canCreate) setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!canCreate) return;
            if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragging
              ? "border-[#c10089] bg-[#FFF7FB]"
              : "border-black/15 bg-neutral-50 hover:border-[#c10089]/50 hover:bg-[#FFF7FB]"
          } ${!canCreate || files.length >= MAX_ATTACHMENTS ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c10089]/10 text-[#c10089]">
            <FileUp className="h-6 w-6" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-neutral-900">
            Arraste arquivos aqui ou clique para anexar
          </span>
          <span className="max-w-sm text-xs leading-5 text-neutral-500">
            Até {MAX_ATTACHMENTS} arquivos · máx. 10MB cada · PDF, Word, Excel, imagens ou ZIP
          </span>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[#c10089] px-3 py-1.5 text-xs font-bold text-white">
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            Escolher arquivos
          </span>
        </button>

        {files.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{file.name}</p>
                  <p className="text-xs text-neutral-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Remover ${file.name}`}
                  onClick={() => syncFiles(files.filter((item) => item !== file))}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">Nenhum anexo selecionado ainda.</p>
        )}
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={!canCreate || pending}>
        {pending ? "Abrindo cotação..." : canCreate ? "Abrir cotação" : "Franquia esgotada"}
      </Button>
    </form>
  );
}
