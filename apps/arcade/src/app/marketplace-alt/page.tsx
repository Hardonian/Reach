import { redirect } from "next/navigation";

// Canonical marketplace is /marketplace. This route is kept for backwards-compatibility.
export default function MarketplaceAltPage() {
  redirect("/marketplace");
}
