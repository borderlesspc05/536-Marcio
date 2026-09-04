import { OrganizationType } from "@/lib/domain/types";
import { renderCalendarPage } from "@/features/appointments/calendar-page";
import { requireAuthorizedSession } from "@/lib/auth/guards";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ServiceCalendarPage({ searchParams }: PageProps) {
  await requireAuthorizedSession({
    types: [OrganizationType.master_service],
    href: "/app/service/calendario",
  });

  return renderCalendarPage({
    searchParams,
    basePath: "/app/service/calendario",
    title: "Calendário Cota Service",
    subtitle: "Visão consolidada dos compromissos de todos os clientes gerenciados.",
  });
}
