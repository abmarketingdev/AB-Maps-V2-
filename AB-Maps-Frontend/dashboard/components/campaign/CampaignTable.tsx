import React from "react";
import { Button } from "../ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";

interface CampaignTableProps {
  campaigns: any[];
  onEdit: (c: any) => void;
  onDelete: (id: string) => void;
  onAssignAreas: (campaign: any) => void;
}

export default function CampaignTable({ campaigns, onEdit, onDelete, onAssignAreas }: CampaignTableProps) {
  return (
    <div className="bg-white rounded-lg shadow border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4 text-base font-semibold">Campaign Name</TableHead>
            <TableHead className="w-1/3 text-base font-semibold">Description</TableHead>
            <TableHead className="w-1/4 text-base font-semibold">Areas</TableHead>
            <TableHead className="w-1/6 text-base font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                No campaigns found.
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((c, i) => (
              <TableRow
                key={c.id}
                className={
                  (i % 2 === 0 ? "bg-background" : "bg-muted/30") +
                  " hover:bg-gray-50 transition"
                }
              >
                <TableCell className="font-medium text-sm py-2 px-3 align-middle">{c.name}</TableCell>
                <TableCell className="text-sm py-2 px-3 align-middle">{c.description}</TableCell>
                <TableCell className="text-sm py-2 px-3 align-middle">{c.areaNames?.join(", ")}</TableCell>
                <TableCell className="flex gap-2 justify-end items-center h-full py-2 px-3 align-middle">
                  <Button onClick={() => onEdit(c)} size="sm" variant="outline">Edit</Button>
                  <Button
                    size="sm"
                    className="bg-black text-white hover:bg-gray-900"
                    onClick={() => onAssignAreas(c)}
                  >
                    Assign Areas
                  </Button>
                  <Button variant="destructive" onClick={() => onDelete(c)} size="sm">Delete</Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
} 