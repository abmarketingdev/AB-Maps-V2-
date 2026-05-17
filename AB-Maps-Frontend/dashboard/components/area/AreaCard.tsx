import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Users, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Area } from "@/services/areaService";

interface AreaCardProps {
  area: Area;
  onEdit: (area: Area) => void;
  onAssignEmployees: (area: Area) => void;
  onDelete: (area: Area) => void;
}

const AreaCard = memo(function AreaCard({ 
  area, 
  onEdit, 
  onAssignEmployees, 
  onDelete 
}: AreaCardProps) {
  return (
    <Card 
      className="w-full hover:shadow-xl transition-all duration-300 ease-in-out border-l-4 hover:scale-[1.02] active:scale-[0.98] cursor-default" 
      style={{ borderLeftColor: area.color }}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div 
              className="w-5 h-5 sm:w-4 sm:h-4 rounded-full flex-shrink-0 shadow-sm" 
              style={{ background: area.color }}
              aria-label={`Color: ${area.color}`}
              title={area.color}
            />
            <h3 className="font-semibold text-base sm:text-lg text-gray-900 truncate">
              {area.name}
            </h3>
          </div>
          
          {/* Dropdown Menu for secondary actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 flex-shrink-0"
                aria-label="More options"
              >
                <MoreVertical className="h-4 w-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(area)}>
                <Edit className="mr-2 h-4 w-4" />
                Rediger
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAssignEmployees(area)}>
                <Users className="mr-2 h-4 w-4" />
                Tildel Ansatte
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(area)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Slett
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Campaign Info */}
        <div className="mb-4">
          {area.campaign?.name ? (
            <Badge variant="outline" className="text-xs sm:text-sm">
              📍 {area.campaign.name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs sm:text-sm opacity-60">
              Ingen kampanje
            </Badge>
          )}
        </div>
        
        {/* Action Buttons - Mobile Optimized */}
        <div className="grid grid-cols-3 gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onEdit(area)}
            className="text-xs sm:text-sm h-9 sm:h-10 transition-all hover:bg-gray-50 active:scale-95"
            aria-label={`Edit ${area.name}`}
          >
            <Edit className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Rediger</span>
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onAssignEmployees(area)}
            className="text-xs sm:text-sm h-9 sm:h-10 transition-all hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 active:scale-95"
            aria-label={`Assign employees to ${area.name}`}
          >
            <Users className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Tildel</span>
          </Button>
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={() => onDelete(area)}
            className="text-xs sm:text-sm h-9 sm:h-10 transition-all active:scale-95"
            aria-label={`Delete ${area.name}`}
          >
            <Trash2 className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Slett</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export default AreaCard;

