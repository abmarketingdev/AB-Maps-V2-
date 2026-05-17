"use client";

import React from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { LessonEditorContent } from "@/components/admin/LessonEditorContent";

export default function LessonEditorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;

  if (!id) return null;

  const isNew = id === "new";
  const lessonId = isNew ? null : parseInt(id, 10);
  if (!isNew && Number.isNaN(lessonId)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-red-600">Ugyldig leksjons-id</p>
        <button type="button" onClick={() => router.push("/admin-dashboard-learning/lessons")} className="ml-4 text-[#141414] underline">
          Tilbake til leksjoner
        </button>
      </div>
    );
  }

  const secParam = searchParams.get("section");
  const secNum = secParam ? parseInt(secParam, 10) : NaN;
  const preselectedSectionId = !Number.isNaN(secNum) ? secNum : undefined;

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col overflow-hidden bg-white">
      <LessonEditorContent
        lessonId={lessonId}
        preselectedSectionId={preselectedSectionId}
        onSuccess={(action, newId) => {
          if (action === "created" && newId) router.replace(`/admin-dashboard-learning/lessons/${newId}`);
        }}
      />
    </div>
  );
}
