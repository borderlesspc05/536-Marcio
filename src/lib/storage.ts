import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { isFirebaseAdminConfigured, getAdminStorage } from "@/lib/firebase/admin";

export type StoredFile = {
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
};

const MAX_BYTES = 10 * 1024 * 1024;

async function storeFile(objectPath: string, file: File): Promise<StoredFile> {
  if (file.size > MAX_BYTES) {
    throw new Error("Arquivo excede 10MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (isFirebaseAdminConfigured()) {
    const bucket = getAdminStorage().bucket();
    const remote = bucket.file(objectPath);
    await remote.save(bytes, {
      contentType: file.type || "application/octet-stream",
      metadata: { cacheControl: "private, max-age=0" },
    });

    return {
      fileName: file.name,
      storagePath: `gs://${bucket.name}/${objectPath}`,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    };
  }

  const localRelative = path.join("uploads", objectPath.replace(/\//g, path.sep));
  const localPath = path.join(process.cwd(), localRelative);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, bytes);

  return {
    fileName: file.name,
    storagePath: `local://${path.relative(process.cwd(), localPath)}`,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

function withSafeName(prefix: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-()\s]/g, "_");
  return `${prefix}/${randomUUID()}-${safeName}`;
}

export async function storeQuotationAttachment(input: {
  organizationId: string;
  quotationId: string;
  file: File;
}): Promise<StoredFile> {
  const objectPath = withSafeName(
    `organizations/${input.organizationId}/quotations/${input.quotationId}`,
    input.file.name,
  );
  return storeFile(objectPath, input.file);
}

export async function storeComplianceDocument(input: {
  organizationId: string;
  file: File;
}): Promise<StoredFile> {
  const objectPath = withSafeName(
    `organizations/${input.organizationId}/compliance`,
    input.file.name,
  );
  return storeFile(objectPath, input.file);
}

export async function storeProposalConditionAttachment(input: {
  organizationId: string;
  proposalId: string;
  conditionIndex: number;
  file: File;
}): Promise<StoredFile> {
  const objectPath = withSafeName(
    `organizations/${input.organizationId}/proposals/${input.proposalId}/c${input.conditionIndex}`,
    input.file.name,
  );
  return storeFile(objectPath, input.file);
}

/** Lê arquivo gravado via store* (gs:// ou local://). */
export async function readStoredFile(storagePath: string): Promise<{
  buffer: Buffer;
  contentType: string;
  fileName: string;
}> {
  if (storagePath.startsWith("local://")) {
    const relative = storagePath.replace(/^local:\/\//, "");
    const absolute = path.isAbsolute(relative) ? relative : path.join(process.cwd(), relative);
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(absolute);
    return {
      buffer,
      contentType: "application/octet-stream",
      fileName: path.basename(absolute),
    };
  }

  if (storagePath.startsWith("gs://")) {
    if (!isFirebaseAdminConfigured()) {
      throw new Error("Firebase Admin necessário para ler anexos no Storage.");
    }
    const withoutScheme = storagePath.slice("gs://".length);
    const slash = withoutScheme.indexOf("/");
    const bucketName = withoutScheme.slice(0, slash);
    const objectPath = withoutScheme.slice(slash + 1);
    const bucket = getAdminStorage().bucket(bucketName);
    const file = bucket.file(objectPath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return {
      buffer,
      contentType: String(metadata.contentType || "application/octet-stream"),
      fileName: path.basename(objectPath),
    };
  }

  throw new Error("Caminho de armazenamento inválido.");
}
