"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Area } from "@/services/areaService";
import AreasGrid from "./AreasGrid";
import { useIsMobile } from "@/hooks/use-mobile";

interface AreasContentProps {
  areas: Area[];
  loading: boolean;
  error?: string | null;
  onEdit: (area: Area) => void;
  onAssignEmployees: (area: Area) => void;
  onDelete: (area: Area) => void;
}

export default function AreasContent({ 
  areas, 
  loading,
  error, 
  onEdit, 
  onAssignEmployees, 
  onDelete 
}: AreasContentProps) {
  const isMobile = useIsMobile();

  // Mobile/Tablet: Use card-based grid (< 1024px)
  if (isMobile) {
    return (
      <div className="block lg:hidden">
        <AreasGrid
          areas={areas}
          loading={loading}
          error={error}
          onEdit={onEdit}
          onAssignEmployees={onAssignEmployees}
          onDelete={onDelete}
        />
      </div>
    );
  }

  // Desktop: Use traditional table (>= 1024px)
  return (
    <div className="hidden lg:block bg-white rounded-lg shadow border overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left font-medium">Navn</th>
            <th className="px-4 py-2 text-left font-medium">Farge</th>
            <th className="px-4 py-2 text-left font-medium">Kampanje</th>
            <th className="px-4 py-2 text-right font-medium">Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} className="text-center py-8">Laster inn...</td>
            </tr>
          ) : areas.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-8">
                Ingen områder funnet.
              </td>
            </tr>
          ) : (
            areas.map(area => (
              <tr key={area.id} className="border-b last:border-0">
                <td className="px-4 py-2">{area.name}</td>
                <td className="px-4 py-2">
                  <span 
                    className="inline-block w-4 h-4 rounded-full mr-2 align-middle" 
                    style={{ background: area.color }} 
                  />
                  {area.color}
                </td>
                <td className="px-4 py-2">{area.campaign?.name || '-'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-2 justify-end">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onEdit(area)}
                    >
                      Rediger
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-black text-white hover:bg-gray-900" 
                      onClick={() => onAssignEmployees(area)}
                    >
                      Tildel Ansatte
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => onDelete(area)}
                    >
                      Slett
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

