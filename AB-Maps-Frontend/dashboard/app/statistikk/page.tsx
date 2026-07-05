import { redirect } from "next/navigation";

// Geografi has been merged into Områder — per-area stats now live alongside the map
// on /areas. Redirect any old links there.
export default function Page() {
  redirect("/areas");
}
