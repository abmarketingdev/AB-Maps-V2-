import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  addEmployeeToArea, 
  removeEmployeeFromArea, 
  getUnassignedEmployeesForArea, 
  getAssignedEmployeesForArea,
  Employee 
} from "@/services/areaEmployeeService";

interface AssignEmployeesToAreaModalProps {
  open: boolean;
  area: any;
  onClose: () => void;
}

const AssignEmployeesToAreaModal: React.FC<AssignEmployeesToAreaModalProps> = ({ open, area, onClose }) => {
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !area) return;
    setLoading(true);
    Promise.all([
      getUnassignedEmployeesForArea(area.id),
      getAssignedEmployeesForArea(area.id),
    ]).then(([avail, assigned]) => {
      setAvailableEmployees(Array.isArray(avail) ? avail : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
    }).finally(() => setLoading(false));
  }, [open, area]);

  if (!area) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Laster område...</DialogTitle>
          </DialogHeader>
          <div className="text-gray-400 text-center py-8">Laster...</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Assign employee: move from available to assigned in real time, with optimistic update
  const handleAssign = async (employee: Employee) => {
    if (!area) return;
    setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAssignedEmployees(prev => [...prev, employee]);
    try {
      await addEmployeeToArea(area.id, employee);
      const [avail, assigned] = await Promise.all([
        getUnassignedEmployeesForArea(area.id),
        getAssignedEmployeesForArea(area.id),
      ]);
      setAvailableEmployees(Array.isArray(avail) ? avail : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
    } finally {
      // no-op
    }
  };

  // Unassign employee: move from assigned to available in real time, with optimistic update
  const handleUnassign = async (employee: Employee) => {
    setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
    setAvailableEmployees(prev => [...prev, employee]);
    try {
      await removeEmployeeFromArea(area.id, employee);
      if (area) {
        const [avail, assigned] = await Promise.all([
          getUnassignedEmployeesForArea(area.id),
          getAssignedEmployeesForArea(area.id),
        ]);
        setAvailableEmployees(Array.isArray(avail) ? avail : []);
        setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
      }
    } finally {
      // no-op
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tildel ansatte til {area?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-8">
          {/* Available Employees */}
          <div className="flex-1 border-r pr-4">
            <h3 className="font-semibold mb-2">Tilgjengelige ansatte</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
              {loading ? (
                <div className="text-gray-400 text-sm">Laster...</div>
              ) : availableEmployees.length === 0 ? (
                <div className="text-gray-400 text-sm">Ingen tilgjengelige ansatte</div>
              ) : (
                <ul className="space-y-2">
                  {availableEmployees.map((employee) => (
                    <li key={employee.id}>
                      <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-gray-500">{employee.email}</div>
                          <div className="text-xs text-gray-400">Status: {employee.status}</div>
                        </div>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-green-100 rounded-full transition border border-green-200"
                          title="Tildel"
                          onClick={() => handleAssign(employee)}
                        >
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {/* Assigned Employees */}
          <div className="flex-1 pl-4">
            <h3 className="font-semibold mb-2">Tildelte ansatte</h3>
            <div className="min-h-[200px] max-h-80 overflow-y-auto scrollbar-hide bg-gray-50 rounded p-2">
              {loading ? (
                <div className="text-gray-400 text-sm">Laster...</div>
              ) : assignedEmployees.length === 0 ? (
                <div className="text-gray-400 text-sm">Ingen tildelte ansatte</div>
              ) : (
                <ul className="space-y-2">
                  {assignedEmployees.map((employee) => (
                    <li key={employee.id}>
                      <div className="flex items-center justify-between bg-white rounded shadow p-3 hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-xs text-gray-500">{employee.email}</div>
                          <div className="text-xs text-gray-400">Status: {employee.status}</div>
                        </div>
                        <button
                          className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-100 rounded-full transition border border-red-200"
                          title="Fjern tildeling"
                          onClick={() => handleUnassign(employee)}
                        >
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} type="button">
            Lukk
          </Button>
          <Button type="button" className="bg-black text-white hover:bg-gray-900" onClick={onClose}>
            Lagre endringer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignEmployeesToAreaModal;
