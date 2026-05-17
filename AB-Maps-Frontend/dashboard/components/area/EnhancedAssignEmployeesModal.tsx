"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, UserCheck, AlertCircle, GripVertical, CheckCircle } from "lucide-react";
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
  DragOverEvent,
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
import { 
  addEmployeeToArea, 
  removeEmployeeFromArea, 
  getUnassignedEmployeesForArea, 
  getAssignedEmployeesForArea,
  Employee 
} from "@/services/areaEmployeeService";
import { Area } from "@/services/areaService";
import { useIsMobile } from "@/hooks/use-mobile";

interface EnhancedAssignEmployeesModalProps {
  open: boolean;
  area: Area | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface DraggableEmployee extends Employee {
  isAssigned: boolean;
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
      className={`bg-white rounded-lg border border-gray-200 ${isMobile ? 'p-3' : 'p-4'} hover:shadow-md transition-all duration-300 ${
        isDragging ? 'shadow-lg scale-105 rotate-2' : ''
      } ${isAssigned ? 'border-green-200 bg-green-50/30' : 'border-blue-200 bg-blue-50/30'} ${isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
        {/* Drag Handle */}
        <div 
          {...(!isMobile ? { ...attributes, ...listeners } : {})}
          className={`${isMobile ? 'p-2' : 'p-1 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded'} transition-colors duration-200 ${
            isDragging ? 'bg-blue-100' : ''
          }`}
          aria-label={`Drag to ${isAssigned ? 'unassign' : 'assign'} ${employee.name}`}
        >
          <GripVertical className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-gray-400 transition-colors duration-200 ${
            isDragging ? 'text-blue-600' : ''
          }`} />
        </div>

        {/* Employee Avatar */}
        <div className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold ${isMobile ? 'text-base' : 'text-sm'}`}>
          {employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
        </div>

        {/* Employee Info */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-gray-900 truncate ${isMobile ? 'text-base' : 'text-sm'}`}>{employee.name}</h4>
          <p className={`text-gray-600 truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{employee.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${
              employee.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className={`text-gray-500 capitalize ${isMobile ? 'text-xs' : 'text-xs'}`}>
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
              className={`text-red-600 border-red-200 hover:bg-red-50 hover:scale-105 transition-all duration-200 ${isMobile ? 'px-4 py-2' : ''}`}
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
              className={`text-blue-600 border-blue-200 hover:bg-blue-50 hover:scale-105 transition-all duration-200 ${isMobile ? 'px-4 py-2' : ''}`}
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
          ? 'border-blue-400 bg-blue-50 scale-[1.02]' 
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className={`flex items-center gap-2 mb-4 ${isMobile ? 'flex-wrap' : ''}`}>
        <Badge variant="outline" className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
          {employees.length}
        </Badge>
        <h3 className={`font-semibold text-gray-900 ${isMobile ? 'text-base' : 'text-lg'}`}>{title}</h3>
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
                <div key={i} className={`bg-white rounded-lg border border-gray-200 ${isMobile ? 'p-3' : 'p-4'} animate-pulse`}>
                  <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
                    <div className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} bg-gray-200 rounded`}></div>
                    <div className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gray-200 rounded-full`}></div>
                    <div className="flex-1">
                      <div className={`${isMobile ? 'h-4' : 'h-3'} bg-gray-200 rounded mb-2`}></div>
                      <div className={`h-3 bg-gray-200 rounded w-3/4`}></div>
                    </div>
                    <div className={`${isMobile ? 'w-20 h-10' : 'w-16 h-8'} bg-gray-200 rounded`}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Users className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {id === 'assigned' 
                  ? 'Tildelte Ansatte' 
                  : 'Tilgjengelige Ansatte'
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
  area,
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
    if (!open || !area) return;
    
    setLoading(true);
    setIsLoading(true);
    setError(null);
    
    Promise.all([
      getUnassignedEmployeesForArea(area.id),
      getAssignedEmployeesForArea(area.id),
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
  }, [open, area]);

  // Filter employees based on search query
  const filteredAvailableEmployees = useMemo(() => {
    if (!searchQuery.trim()) return availableEmployees;
    
    const query = searchQuery.toLowerCase();
    return availableEmployees.filter(emp => 
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query)
    );
  }, [availableEmployees, searchQuery]);

  const filteredAssignedEmployees = useMemo(() => {
    if (!searchQuery.trim()) return assignedEmployees;
    
    const query = searchQuery.toLowerCase();
    return assignedEmployees.filter(emp => 
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query)
    );
  }, [assignedEmployees, searchQuery]);


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

    if (!over || !area) {
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
    if (!area) return;

    // Optimistic update
    setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAssignedEmployees(prev => [...prev, employee]);

    try {
      await addEmployeeToArea(area.id, employee);
      // Refresh data to ensure consistency
      const [avail, assigned] = await Promise.all([
        getUnassignedEmployeesForArea(area.id),
        getAssignedEmployeesForArea(area.id),
      ]);
      setAvailableEmployees(Array.isArray(avail) ? avail : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
    } catch (error) {
      // Revert optimistic update on error
      setAvailableEmployees(prev => [...prev, employee]);
      setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
      setError("Kunne ikke tildele ansatt. Vennligst prøv igjen.");
    }
  };

  // Unassign employee
  const handleUnassign = async (employee: Employee) => {
    if (!area) return;

    // Optimistic update
    setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAvailableEmployees(prev => [...prev, employee]);

    try {
      await removeEmployeeFromArea(area.id, employee);
      // Refresh data to ensure consistency
      const [avail, assigned] = await Promise.all([
        getUnassignedEmployeesForArea(area.id),
        getAssignedEmployeesForArea(area.id),
      ]);
      setAvailableEmployees(Array.isArray(avail) ? avail : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
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

  if (!area) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Laster område...</DialogTitle>
          </DialogHeader>
          <div className="text-gray-400 text-center py-8">
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
        <DialogHeader className="sticky top-0 bg-white z-10 border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tildel ansatte til "{area.name}"
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {/* Search Bar */}
          <div className="sticky top-0 bg-white z-10 py-4 mb-6 border-b">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-5 w-5' : 'h-4 w-4'} text-gray-400`} />
              <Input
                placeholder="Søk etter ansatte ved navn eller e-post..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${isMobile ? 'text-base h-12' : ''}`}
              />
            </div>
          </div>

          {/* Simple Stats Row */}
          <div className={`mb-4 flex ${isMobile ? 'justify-between px-2' : 'justify-center gap-8'} ${isMobile ? 'text-sm' : 'text-sm'} text-gray-600`}>
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
                  <span className="text-sm font-medium text-gray-700">Tilgjengelige Ansatte</span>
                </div>
                <DropZone
                  id="available"
                  title="Tilgjengelige Ansatte"
                  employees={filteredAvailableEmployees}
                  onAssign={handleAssign}
                  onUnassign={handleUnassign}
                  isLoading={isLoading}
                />
              </div>
              
              {/* Row 2: Assigned Employees */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Tildelte Ansatte</span>
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
            {isLoading ? 'Lagrer...' : 'Lagre endringer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
