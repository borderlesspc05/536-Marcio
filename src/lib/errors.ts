import { unstable_rethrow } from "next/navigation";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

function isInternalErrorMessage(message: string): boolean {
  return /NEXT_|Firestore|Firebase|EPERM|ENOENT|Invariant|digest/i.test(
    message,
  );
}

function isUserFacingErrorMessage(message: string): boolean {
  if (!message || message.length > 220) return false;
  if (isInternalErrorMessage(message)) return false;
  return /[áàâãéêíóôõúç]|plano|login|sessão|pagamento|organização|fornecedor|cotação|migração|não |obrigatório|Asaas|checkout/i.test(
    message,
  );
}

export function toPublicErrorMessage(error: unknown): string {
  unstable_rethrow(error);

  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return "Sessão expirada. Faça login novamente.";
  }

  if (
    error instanceof Error &&
    (error as Error & { firebaseCode?: string }).firebaseCode
  ) {
    return error.message;
  }

  if (error instanceof Error && isUserFacingErrorMessage(error.message)) {
    return error.message;
  }

  console.error("[action]", error);
  return "Não foi possível concluir a operação. Tente novamente.";
}
