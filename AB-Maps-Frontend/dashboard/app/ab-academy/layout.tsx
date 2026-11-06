"use client";

import React, { useEffect } from "react";

/**
 * AB Academy shell (visual only: no auth, no data).
 *
 * The dashboard is dark by default (<html class="dark">). Everything under /ab-academy is the
 * light AB Academy product, so the `.academy-light` token scope (app/globals.css) is set on the
 * page root AND on <body> while an academy page is mounted: Radix portals (sheets, dialogs,
 * dropdowns, toasts) render straight into <body>, outside the page root, and would otherwise
 * stay dark. The cleanup removes the body class again, so client-side navigation out of the
 * academy (to /map, /sales, …) gets the normal dark dashboard back.
 */
export default function AbAcademyLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("academy-light");
    return () => {
      document.body.classList.remove("academy-light");
    };
  }, []);

  return <div className="academy-light min-h-screen bg-[#F7F7F5] text-[#0A0A0A] antialiased">{children}</div>;
}
