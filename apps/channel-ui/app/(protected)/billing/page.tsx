import { redirect } from "next/navigation";

export default function BillingRootPage() {
  redirect("/billing/accounts");
}
