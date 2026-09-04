import { firestoreDb } from "@/lib/firebase/firestore-db";
import { AppointmentLeadMode } from "@/lib/domain/types";

const LEAD_DAYS: Record<Exclude<AppointmentLeadMode, "exact_date">, number> = {
  days_15: 15,
  days_30: 30,
  days_60: 60,
  days_90: 90,
};

export function computeDispatchDate(input: {
  appointmentDate: Date;
  leadMode: AppointmentLeadMode;
  leadExactDate: Date | null;
}): Date {
  if (input.leadMode === "exact_date" && input.leadExactDate) {
    return input.leadExactDate;
  }
  if (input.leadMode === "exact_date") {
    return input.appointmentDate;
  }
  const days = LEAD_DAYS[input.leadMode];
  const dispatch = new Date(input.appointmentDate);
  dispatch.setDate(dispatch.getDate() - days);
  return dispatch;
}

export async function runAppointmentDispatchJob() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const appointments = await firestoreDb.serviceAppointment.findMany({
    where: { lastDispatchedAt: null },
    include: {
      condominium: true,
      category: true,
      serviceItem: true,
      organization: true,
    },
  });

  let dispatched = 0;

  for (const appointment of appointments) {
    const dispatchDate = computeDispatchDate({
      appointmentDate: appointment.appointmentDate,
      leadMode: appointment.leadMode,
      leadExactDate: appointment.leadExactDate,
    });

    if (dispatchDate < start || dispatchDate > end) continue;

    const dedupeKey = `appointment_dispatch:${appointment.id}`;
    const existing = await firestoreDb.reminderDispatch.findUnique({ where: { dedupeKey } });
    if (existing) continue;

    const requesterEmail =
      appointment.condominium.contactEmail ??
      appointment.organization.name;

    await firestoreDb.emailOutbox.create({
      data: {
        toEmail: requesterEmail.includes("@") ? requesterEmail : "operacional@cotacondo.local",
        subject: `Disparo automático — ${appointment.category.name} · ${appointment.condominium.name}`,
        bodyText: [
          `Compromisso agendado para ${appointment.appointmentDate.toLocaleDateString("pt-BR")}.`,
          `Condomínio: ${appointment.condominium.name}`,
          `Serviço: ${appointment.category.name}${appointment.serviceItem ? ` — ${appointment.serviceItem.name}` : ""}`,
          "",
          "O motor Cota Service iniciará a solicitação de novas propostas conforme a antecedência configurada.",
        ].join("\n"),
        template: "appointment_auto_dispatch",
        metadataJson: JSON.stringify({ appointmentId: appointment.id }),
      },
    });

    await firestoreDb.reminderDispatch.create({
      data: {
        dedupeKey,
        kind: "appointment_dispatch",
        entityId: appointment.id,
      },
    });

    await firestoreDb.serviceAppointment.update({
      where: { id: appointment.id },
      data: { lastDispatchedAt: new Date() },
    });

    dispatched += 1;
  }

  return { dispatched, checked: appointments.length };
}
