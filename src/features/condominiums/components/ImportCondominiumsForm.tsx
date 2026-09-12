"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileUp, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { importCondominiumsAction, type ImportResult } from "@/features/condominiums/actions";

type Props = {
  onDone?: () => void;
};

export function ImportCondominiumsForm({ onDone }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function assignFile(file: File | null) {
    setFileName(file?.name ?? null);
    if (fileRef.current) {
      if (!file) {
        fileRef.current.value = "";
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileRef.current.files = transfer.files;
    }
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-5 sm:p-6"
      action={(formData) => {
        startTransition(async () => {
          const response = await importCondominiumsAction(formData);
          setResult(response);
          if (response.ok) {
            assignFile(null);
            onDone?.();
            router.refresh();
          }
        });
      }}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#c10089]">
          Etapa · Importação
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <FileSpreadsheet className="h-5 w-5 text-[#c10089]" />
          Importar CSV
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Colunas obrigatórias:{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">
            nome,endereco,cnpj,contato,email,telefone
          </code>
          . Opcionais:{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs">torres,unidades</code>. Máx. 500
          linhas / 2MB.
        </p>
      </div>

      <a
        href="/templates/condominios-template.csv"
        className="inline-flex text-sm font-semibold text-[#c10089] hover:underline"
      >
        Baixar template CSV
      </a>

      <input
        ref={fileRef}
        name="file"
        type="file"
        accept=".csv,text/csv"
        required
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
          dragging
            ? "border-[#c10089] bg-[#FFF7FB]"
            : fileName
              ? "border-emerald-300 bg-emerald-50/70"
              : "border-black/15 bg-neutral-50 hover:border-[#c10089]/50 hover:bg-[#FFF7FB]"
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c10089]/10 text-[#c10089]">
          <FileUp className="h-6 w-6" aria-hidden />
        </span>
        {fileName ? (
          <>
            <span className="text-sm font-semibold text-neutral-900">Arquivo selecionado</span>
            <span className="max-w-full truncate px-2 text-sm text-emerald-800">{fileName}</span>
            <span className="text-xs text-neutral-500">Clique ou arraste para trocar</span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-neutral-900">
              Arraste o CSV aqui ou clique para anexar
            </span>
            <span className="text-xs text-neutral-500">Somente .csv · máx. 2MB</span>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[#c10089] px-3 py-1.5 text-xs font-bold text-white">
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              Escolher arquivo
            </span>
          </>
        )}
      </button>

      {fileName ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
          <p className="truncate text-sm font-medium text-neutral-900">{fileName}</p>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-700"
            aria-label="Remover arquivo"
            onClick={() => assignFile(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Importando..." : "Importar"}
      </Button>

      {result ? (
        <div className="space-y-2 text-sm">
          <p className={result.ok ? "text-emerald-700" : "text-red-700"}>{result.message}</p>
          {result.errors.length > 0 ? (
            <ul className="max-h-40 overflow-auto rounded-xl bg-red-50 p-3 text-red-700">
              {result.errors.slice(0, 40).map((error) => (
                <li key={`${error.line}-${error.message}`}>
                  Linha {error.line}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
          {result.duplicates.length > 0 ? (
            <ul className="max-h-40 overflow-auto rounded-xl bg-amber-50 p-3 text-amber-900">
              {result.duplicates.slice(0, 40).map((item) => (
                <li key={`${item.line}-${item.existingId}`}>
                  Linha {item.line}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
