"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, AlertCircle, GripVertical, CheckCircle } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import {
  CSS,
} from "@dnd-kit/utilities";
import { useIsMobile } from "@/hooks/use-mobile";
import { makeAuthenticatedRequest } from "@/services/campaignAreaService";
import { buildApiUrl } from '@/lib/config/apiConfig';

interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
  person_type?: string;
  phone?: string | null;
  is_online?: boolean;
  ab_person_id?: string | null;
  assigned_at?: string | null;
}

interface EnhancedAssignEmployeesModalProps {
  open: boolean;
  campaign: any;
  onClose: () => void;
  onSuccess?: () => void;
}

// Helper functions for API calls
async function fetchAvailableEmployeesForCampaign(campaignId: string): Promise<Employee[]> {
  try {
    const url = buildApiUrl(`/api/campaigns/campaigns/unassigned_employees/?campaign_id=${campaignId}`);
    const res = await makeAuthenticatedRequest(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function fetchAssignedEmployeesForCampaign(campaignId: string): Promise<Employee[]> {
  try {
    const url = buildApiUrl(`/api/campaigns/campaigns/${campaignId}/assigned_employees/`);
    const res = await makeAuthenticatedRequest(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function assignEmployeeToCampaign(campaignId: string, person: Employee): Promise<boolean> {
  try {
    const url = buildApiUrl(`/api/campaigns/campaigns/${campaignId}/add_employee/`);
    
    // Determine payload based on person_type
    let payload: { manager_id?: string; employee_id?: string };
    if (person.person_type === 'manager') {
      payload = { manager_id: person.id };  // Use manager_id for managers
    } else {
      payload = { employee_id: person.id };  // Use employee_id for employees
    }
    
    console.log('Sending payload:', payload);  // Debug
    
    const res = await makeAuthenticatedRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function removeEmployeeFromCampaign(campaignId: string, person: Employee): Promise<boolean> {
  try {
    // Determine query parameter based on person_type
    let queryParam: string;
    if (person.person_type === 'manager') {
      queryParam = `manager_id=${person.id}`;  // Use manager_id for managers
    } else {
      queryParam = `employee_id=${person.id}`;  // Use employee_id for employees
    }
    
    const url = buildApiUrl(`/api/campaigns/campaigns/${campaignId}/remove_employee/?${queryParam}`);
    
    console.log('Removing with query param:', queryParam);  // Debug
    
    const res = await makeAuthenticatedRequest(url, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Draggable Employee Card Component
function DraggableEmployeeCard({ 
  employee, 
  isAssigned, 
  onAssign, 
  onUnassign,
  isDragging = false 
}: { 
  employee: Employee; 
  isAssigned: boolean; 
  onAssign: () => void;
  onUnassign: () => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: employee.id });

  const isMobile = useIsMobile();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0 : 1,
    ...(isMobile ? { touchAction: 'none' } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isMobile ? { ...attributes, ...listeners } : {})}
      className={`bg-ab-elevated rounded-lg border border-ab-line ${isMobile ? 'p-3' : 'p-4'} hover:shadow-md transition-all duration-300 ${
        isDragging ? 'shadow-lg scale-105 rotate-2' : ''
      } ${isAssigned ? 'border-ab-success/25 bg-ab-success/5' : 'border-ab-accent/25 bg-ab-accent/5'} ${isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
        {/* Drag Handle */}
        <div 
          {...(!isMobile ? { ...attributes, ...listeners } : {})}
          className={`${isMobile ? 'p-2' : 'p-1 cursor-grab active:cursor-grabbing hover:bg-ab-hover rounded'} transition-colors duration-200 ${
            isDragging ? 'bg-ab-accent/15' : ''
          }`}
          aria-label={`Drag to ${isAssigned ? 'unassign' : 'assign'} ${employee.name}`}
        >
          <GripVertical className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-ab-fg-3 transition-colors duration-200 ${
            isDragging ? 'text-ab-accent' : ''
          }`} />
        </div>

        {/* Employee Avatar */}
        <div className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold ${isMobile ? 'text-base' : 'text-sm'}`}>
          {employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </div>

        {/* Employee Info */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-ab-fg truncate ${isMobile ? 'text-base' : 'text-sm'}`}>{employee.name}</h4>
          <p className={`text-ab-fg-2 truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{employee.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${
              employee.status === 'online' ? 'bg-green-500' : 'bg-ab-fg-3'
            }`} />
            <span className={`text-ab-fg-3 capitalize ${isMobile ? 'text-xs' : 'text-xs'}`}>
              {employee.status || 'offline'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div 
          className="flex-shrink-0"
          onPointerDown={(e) => { if (isMobile) e.stopPropagation(); }}
          onTouchStart={(e) => { if (isMobile) e.stopPropagation(); }}
          onClick={(e) => e.stopPropagation()}
        >
          {isAssigned ? (
            <Button
              size={isMobile ? "default" : "sm"}
              variant="outline"
              onClick={onUnassign}
              className={`text-ab-danger border-ab-danger/20 hover:bg-ab-danger/10 hover:scale-105 transition-all duration-200 ${isMobile ? 'px-4 py-2' : ''}`}
            >
              <span className="flex items-center gap-1">
                <span>Fjern</span>
                <span className="text-xs">✕</span>
              </span>
            </Button>
          ) : (
            <Button
              size={isMobile ? "default" : "sm"}
              variant="outline"
              onClick={onAssign}
              className={`text-ab-accent border-ab-accent/20 hover:bg-ab-accent/10 hover:scale-105 transition-all duration-200 ${isMobile ? 'px-4 py-2' : ''}`}
            >
              <span className="flex items-center gap-1">
                <span>Legg til</span>
                <span className="text-xs">+</span>
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


// Drop Zone Component
function DropZone({ 
  id, 
  title, 
  employees, 
  onAssign, 
  onUnassign,
  isLoading = false
}: {
  id: string;
  title: string;
  employees: Employee[];
  onAssign: (employee: Employee) => void;
  onUnassign: (employee: Employee) => void;
  isLoading?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const isMobile = useIsMobile();

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 ${isMobile ? 'p-3' : 'p-4'} rounded-lg border-2 border-dashed transition-all duration-200 ${
        isOver 
          ? 'border-ab-accent/50 bg-ab-accent/10 scale-[1.02]' 
          : 'border-ab-line bg-ab-subtle'
      }`}
    >
      <div className={`flex items-center gap-2 mb-4 ${isMobile ? 'flex-wrap' : ''}`}>
        <Badge variant="outline" className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
          {employees.length}
        </Badge>
        <h3 className={`font-semibold text-ab-fg ${isMobile ? 'text-base' : 'text-lg'}`}>{title}</h3>
        {isOver && (
          <Badge variant="default" className="bg-blue-600 text-white animate-pulse">
            Slipp her
          </Badge>
        )}
      </div>
      
      <SortableContext items={employees.map(emp => emp.id)} strategy={verticalListSortingStrategy}>
        <div className="max-h-[400px] overflow-y-auto space-y-3 min-h-[200px] pr-2">
          {isLoading ? (
            // Loading skeleton
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`bg-ab-elevated rounded-lg border border-ab-line ${isMobile ? 'p-3' : 'p-4'} animate-pulse`}>
                  <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
                    <div className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} bg-ab-active rounded`}></div>
                    <div className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-ab-active rounded-full`}></div>
                    <div className="flex-1">
                      <div className={`${isMobile ? 'h-4' : 'h-3'} bg-ab-active rounded mb-2`}></div>
                      <div className={`h-3 bg-ab-active rounded w-3/4`}></div>
                    </div>
                    <div className={`${isMobile ? 'w-20 h-10' : 'w-16 h-8'} bg-ab-active rounded`}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-ab-fg-3">
              <Users className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {id === 'assigned' 
                  ? 'Ingen tildelte ansatte' 
                  : 'Ingen tilgjengelige ansatte'
                }
              </p>
            </div>
          ) : (
            employees.map((employee) => (
              <DraggableEmployeeCard
                key={employee.id}
                employee={employee}
                isAssigned={id === 'assigned'}
                onAssign={() => onAssign(employee)}
                onUnassign={() => onUnassign(employee)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function EnhancedAssignEmployeesModal({
  open,
  campaign,
  onClose,
  onSuccess
}: EnhancedAssignEmployeesModalProps) {
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isMobile = useIsMobile();

  // Drag and drop sensors - optimized for mobile
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Load employees when modal opens
  useEffect(() => {
    if (!open || !campaign) return;
    
    setLoading(true);
    setIsLoading(true);
    setError(null);
    
    Promise.all([
      fetchAvailableEmployeesForCampaign(campaign.id),
      fetchAssignedEmployeesForCampaign(campaign.id),
    ])
      .then(([avail, assigned]) => {
        setAvailableEmployees(Array.isArray(avail) ? avail : []);
        setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
      })
      .catch((err) => {
        setError("Kunne ikke laste ansatte. Vennligst prøv igjen.");
      })
      .finally(() => {
        setLoading(false);
        setIsLoading(false);
      });
  }, [open, campaign]);

  // Filter employees based on search query
  const filteredAvailableEmployees = useMemo(() => {
    if (!searchQuery.trim()) return availableEmployees;
    
    const query = searchQuery.toLowerCase();
    return availableEmployees.filter(emp => 
      (emp.name ?? "").toLowerCase().includes(query) ||
      (emp.email ?? "").toLowerCase().includes(query)
    );
  }, [availableEmployees, searchQuery]);

  const filteredAssignedEmployees = useMemo(() => {
    if (!searchQuery.trim()) return assignedEmployees;
    
    const query = searchQuery.toLowerCase();
    return assignedEmployees.filter(emp => 
      (emp.name ?? "").toLowerCase().includes(query) ||
      (emp.email ?? "").toLowerCase().includes(query)
    );
  }, [assignedEmployees, searchQuery]);

  // Pagination for the (potentially large) available list — keeps the modal snappy by
  // rendering ~20 draggable rows at a time instead of the full 300+.
  const AVAILABLE_PAGE_SIZE = 20;
  const [availablePage, setAvailablePage] = useState(1);
  useEffect(() => { setAvailablePage(1); }, [searchQuery, availableEmployees.length]);
  const availableTotalPages = Math.max(1, Math.ceil(filteredAvailableEmployees.length / AVAILABLE_PAGE_SIZE));
  const pagedAvailableEmployees = useMemo(
    () => filteredAvailableEmployees.slice(
      (availablePage - 1) * AVAILABLE_PAGE_SIZE, availablePage * AVAILABLE_PAGE_SIZE),
    [filteredAvailableEmployees, availablePage]
  );


  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const employee = [...availableEmployees, ...assignedEmployees].find(
      emp => emp.id === active.id
    );
    setActiveEmployee(employee || null);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEmployee(null);

    if (!over || !campaign) {
      return;
    }

    const employee = [...availableEmployees, ...assignedEmployees].find(
      emp => emp.id === active.id
    );

    if (!employee) {
      return;
    }

    const isCurrentlyAssigned = assignedEmployees.some(emp => emp.id === employee.id);
    
    // Determine target drop zone
    // over.id can be either a drop zone ID ('available' or 'assigned') or an employee ID
    let targetIsAssigned: boolean;
    
    if (over.id === 'assigned' || over.id === 'available') {
      // Dropped directly on a drop zone
      targetIsAssigned = over.id === 'assigned';
    } else {
      // Dropped on another employee card, determine which zone it belongs to
      const targetEmployee = [...availableEmployees, ...assignedEmployees].find(
        emp => emp.id === over.id
      );
      if (targetEmployee) {
        targetIsAssigned = assignedEmployees.some(emp => emp.id === targetEmployee.id);
      } else {
        return;
      }
    }

    // Only perform action if assignment status changes
    if (isCurrentlyAssigned !== targetIsAssigned) {
      if (targetIsAssigned) {
        await handleAssign(employee);
      } else {
        await handleUnassign(employee);
      }
    }
  };

  // Assign employee
  const handleAssign = async (employee: Employee) => {
    if (!campaign) return;

    // Optimistic update
    setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAssignedEmployees(prev => [...prev, employee]);

    try {
      const success = await assignEmployeeToCampaign(campaign.id, employee);
      if (success) {
        // Refresh data to ensure consistency
        const [avail, assigned] = await Promise.all([
          fetchAvailableEmployeesForCampaign(campaign.id),
          fetchAssignedEmployeesForCampaign(campaign.id),
        ]);
        setAvailableEmployees(Array.isArray(avail) ? avail : []);
        setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
      } else {
        throw new Error('Failed to assign');
      }
    } catch (error) {
      // Revert optimistic update on error
      setAvailableEmployees(prev => [...prev, employee]);
      setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
      setError("Kunne ikke tildele ansatt. Vennligst prøv igjen.");
    }
  };

  // Unassign employee
  const handleUnassign = async (employee: Employee) => {
    if (!campaign) return;

    // Optimistic update
    setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAvailableEmployees(prev => [...prev, employee]);

    try {
      const success = await removeEmployeeFromCampaign(campaign.id, employee);
      if (success) {
        // Refresh data to ensure consistency
        const [avail, assigned] = await Promise.all([
          fetchAvailableEmployeesForCampaign(campaign.id),
          fetchAssignedEmployeesForCampaign(campaign.id),
        ]);
        setAvailableEmployees(Array.isArray(avail) ? avail : []);
        setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
      } else {
        throw new Error('Failed to unassign');
      }
    } catch (error) {
      // Revert optimistic update on error
      setAssignedEmployees(prev => [...prev, employee]);
      setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
      setError("Kunne ikke fjerne ansatt. Vennligst prøv igjen.");
    }
  };

  // Handle modal close
  const handleClose = () => {
    setSearchQuery("");
    setError(null);
    setActiveEmployee(null);
    onClose();
  };

  if (!campaign) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Laster kampanje...</DialogTitle>
          </DialogHeader>
          <div className="text-ab-fg-3 text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2">Laster...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[95vh]' : 'max-w-6xl max-h-[90vh]'} flex flex-col overflow-hidden`}>
        <DialogHeader className="sticky top-0 bg-ab-elevated z-10 border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tildel ansatte til "{campaign.name}"
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* Search Bar */}
          <div className="sticky top-0 bg-ab-elevated z-10 py-4 mb-6 border-b">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-ab-fg-3`} />
              <Input
                placeholder="Søk etter ansatte ved navn eller e-post..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${isMobile ? 'text-base h-12' : ''}`}
              />
            </div>
          </div>

          {/* Simple Stats Row */}
          <div className={`mb-4 flex ${isMobile ? 'justify-between px-2' : 'justify-center gap-8'} ${isMobile ? 'text-sm' : 'text-sm'} text-ab-fg-2`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Tilgjengelige: {availableEmployees.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Tildelte: {assignedEmployees.length}</span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className={`flex items-center gap-2 ${isMobile ? 'p-4' : 'p-3'} bg-red-50 border border-red-200 rounded-lg mb-4`}>
              <AlertCircle className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-red-600`} />
              <span className={`${isMobile ? 'text-base' : 'text-sm'} text-red-800 flex-1`}>{error}</span>
              <Button
                size={isMobile ? "default" : "sm"}
                variant="outline"
                onClick={() => setError(null)}
                className={`text-red-600 border-red-300 ${isMobile ? 'px-3 py-2' : ''}`}
              >
                Lukk
              </Button>
            </div>
          )}

          {/* Success Display */}
          {successMessage && (
            <div className={`flex items-center gap-2 ${isMobile ? 'p-4' : 'p-3'} bg-green-50 border border-green-200 rounded-lg mb-4`}>
              <CheckCircle className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-green-600`} />
              <span className={`${isMobile ? 'text-base' : 'text-sm'} text-green-800 flex-1`}>{successMessage}</span>
              <Button
                size={isMobile ? "default" : "sm"}
                variant="outline"
                onClick={() => setSuccessMessage(null)}
                className={`text-green-600 border-green-300 ${isMobile ? 'px-3 py-2' : ''}`}
              >
                Lukk
              </Button>
            </div>
          )}

          {/* Drag and Drop Interface */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-6">
              {/* Row 1: Available Employees */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-ab-fg-2">Tilgjengelige Ansatte</span>
                </div>
                <DropZone
                  id="available"
                  title="Tilgjengelige Ansatte"
                  employees={pagedAvailableEmployees}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                  isLoading={isLoading}
                />
                {availableTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 mt-3 text-sm text-ab-fg-2">
                    <span className="tabular-nums">
                      Viser {(availablePage - 1) * AVAILABLE_PAGE_SIZE + 1}–
                      {Math.min(availablePage * AVAILABLE_PAGE_SIZE, filteredAvailableEmployees.length)} av {filteredAvailableEmployees.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={availablePage <= 1}
                        onClick={() => setAvailablePage(p => Math.max(1, p - 1))}
                      >
                        Forrige
                      </Button>
                      <span className="tabular-nums">{availablePage} / {availableTotalPages}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={availablePage >= availableTotalPages}
                        onClick={() => setAvailablePage(p => Math.min(availableTotalPages, p + 1))}
                      >
                        Neste
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Row 2: Assigned Employees */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-ab-fg-2">Tildelte Ansatte</span>
                </div>
                <DropZone
                  id="assigned"
                  title="Tildelte Ansatte"
                  employees={filteredAssignedEmployees}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                  isLoading={isLoading}
                />
              </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeEmployee ? (
                <div className="transform rotate-3 scale-105 opacity-90">
                  <DraggableEmployeeCard
                    employee={activeEmployee}
                    isAssigned={assignedEmployees.some(emp => emp.id === activeEmployee.id)}
                    onAssign={() => {}}
                    onUnassign={() => {}}
                    isDragging={true}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        <DialogFooter className={`mt-6 ${isMobile ? 'flex-col gap-2' : 'flex-row'}`}>
          <Button 
            variant="outline" 
            onClick={handleClose}
            className={isMobile ? 'w-full' : ''}
          >
            Lukk
          </Button>
          <Button 
            onClick={() => {
              setIsLoading(true);
              setSuccessMessage('Ansattetildelinger lagret!');
              
              // Simulate API call
              setTimeout(() => {
                setIsLoading(false);
                setTimeout(() => {
                  onSuccess?.();
                  handleClose();
                }, 1500);
              }, 1000);
            }}
            disabled={isLoading}
            className={`bg-blue-600 hover:bg-blue-700 ${isMobile ? 'w-full' : ''} ${isLoading ? 'opacity-50' : ''}`}
          >
            {isLoading ? 'Lagrer...' : 'Lagre Endringer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

