import { redirect } from "next/navigation";
import { getCurrentUserRole, getRoleHome } from "@/lib/services/access-control";

export default async function Home() {
  redirect(getRoleHome(await getCurrentUserRole()));
}
