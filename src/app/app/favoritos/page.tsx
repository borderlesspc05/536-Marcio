import { redirect } from "next/navigation";

/** Favoritos foi unificado em Parcerias (prioridade 1 do motor). */
export default function FavoritosRedirectPage() {
  redirect("/app/parcerias");
}
