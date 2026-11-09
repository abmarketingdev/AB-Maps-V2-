"use client"

// Full-screen notice for a person who must finish an assigned course before using the map.
// Self-contained: checks Learning on mount and on every route change; hidden on the course
// pages themselves so the person can finish the course, and on the own calendar (Min kalender). Renders nothing for everyone else.
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen } from "lucide-react"
import { courseNames, courseUrl, fetchCourseGate, type CourseGateState } from "@/services/courseGateService"

export function CourseGateNotice() {
  const pathname = usePathname() || ""
  const router = useRouter()
  const [state, setState] = useState<CourseGateState | null>(null)

  useEffect(() => {
    let alive = true
    fetchCourseGate().then((s) => { if (alive) setState(s) })
    return () => { alive = false }
  }, [pathname])

  const onCoursePage = pathname === "/ab-academy" || pathname.startsWith("/ab-academy/")
  // Reading your own calendar is not field work: the promoter keeps «Kalender» while a course is open.
  const onOwnCalendar = pathname === "/employee/kalender" || pathname.startsWith("/employee/kalender/")
  if (!state?.blocked || onCoursePage || onOwnCalendar) return null

  const plural = state.sections.length > 1
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="course-gate-title">
      <div className="w-full max-w-md rounded-ab-lg border border-ab-line bg-ab-elevated p-6 text-center shadow-xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ab-accent/10 text-ab-accent">
          <BookOpen className="h-6 w-6" />
        </div>
        <h2 id="course-gate-title" className="text-lg font-semibold text-ab-fg">Kurs må fullføres</h2>
        <p className="mt-2 text-sm text-ab-fg-2">
          Du må fullføre {plural ? "kursene" : "kurset"}{" "}
          <strong className="text-ab-fg">{courseNames(state.sections)}</strong> før du kan bruke kartet.
        </p>
        <button
          type="button"
          onClick={() => router.push(courseUrl(state))}
          className="mt-5 h-10 w-full rounded-ab-md bg-ab-accent text-sm font-semibold text-white hover:opacity-90"
        >
          Gå til kurset
        </button>
      </div>
    </div>
  )
}
