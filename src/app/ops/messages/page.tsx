import { redirect } from "next/navigation";

export default function OpsMessagesRedirectPage() {
  redirect("/ops/approvals");
}
