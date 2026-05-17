import React from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Calendar, User, MapPin, Edit, Trash2, Users } from "lucide-react";

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    description: string;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    created_by_id?: string;
    areaNames?: string[];
  };
  onEdit: (campaign: any) => void;
  onDelete: (campaign: any) => void;
  onAssignEmployees: (campaign: any) => void;
  isOwner?: boolean;
}

export default function CampaignCard({ 
  campaign, 
  onEdit, 
  onDelete, 
  onAssignEmployees, 
  isOwner = false 
}: CampaignCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <Card className="w-full max-w-sm hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
              {campaign.name}
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              {truncateText(campaign.description || "No description", 80)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onEdit(campaign)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <Edit className="w-4 h-4 text-gray-600" />
            </Button>
            <Button
              onClick={() => onDelete(campaign)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4 text-gray-600" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <User className="w-4 h-4 mr-2" />
            <span>Opprettet av: {campaign.created_by || "Ukjent"}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>Opprettet: {formatDate(campaign.created_at)}</span>
          </div>
          
          {campaign.areaNames && campaign.areaNames.length > 0 && (
            <div className="flex items-start text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {campaign.areaNames.slice(0, 3).map((area, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {area}
                  </Badge>
                ))}
                {campaign.areaNames.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{campaign.areaNames.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="pt-0 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2"
          onClick={() => onAssignEmployees(campaign)}
        >
          <Users className="w-4 h-4 mr-2" /> Tildel ansatte
        </Button>
      </CardFooter>
    </Card>
  );
} 