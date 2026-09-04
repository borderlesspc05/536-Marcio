import { OrganizationType } from "@/lib/domain/types";
import { renderCalendarPage } from "@/features/appointments/calendar-page";
import { requireAuthorizedSession } from "@/lib/auth/guards";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function CalendarPage({ searchParams }: PageProps) {
  await requireAuthorizedSession({
    types: [OrganizationType.administradora, OrganizationType.sindico],
    href: "/app/calendario",
  });

  return renderCalendarPage({
    searchParams,
    basePath: "/app/calendario",
    title: "Calendário de Compromissos",
    subtitle: "Consulte e gerencie compromissos de serviços recorrentes dos condomínios.",
  });
}
