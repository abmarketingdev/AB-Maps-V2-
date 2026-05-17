"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assignTask } from '@/services/adminTaskService';
import { AdminAssignedTask } from '@/types/todo';
import { 
  Save, 
  X, 
  AlertTriangle,
  Clock,
  Plus,
  Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AssigneeSelectionModal } from './AssigneeSelectionModal';

interface CreateTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (task: AdminAssignedTask) => void;
}

interface FormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string;
}

interface SelectedAssignee {
  id: string;
  name: string;
  email: string;
}

export function CreateTaskForm({ isOpen, onClose, onSuccess }: CreateTaskFormProps) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: 'medium',
    deadline: ''
  });
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<SelectedAssignee[]>([]);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      setError('Tittel er påkrevd');
      return;
    }
    if (selectedAssignees.length === 0) {
      setError('Vennligst velg minst én mottaker');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined,
        assignee_ids: selectedAssignees.map(a => a.id)
      };

      const newTask = await assignTask(taskData);
      
      // Reset form
      setFormData({ title: '', description: '', priority: 'medium', deadline: '' });
      setSelectedAssignees([]);
      
      onSuccess(newTask);
      
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette oppgave');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setFormData({ title: '', description: '', priority: 'medium', deadline: '' });
    setSelectedAssignees([]);
    setError(null);
    onClose();
  };

  const handleAssigneesSelected = (assignees: SelectedAssignee[]) => {
    setSelectedAssignees(assignees);
    setShowAssigneeModal(false);
    setError(null);
  };

  const removeAssignee = (id: string) => {
    setSelectedAssignees(prev => prev.filter(a => a.id !== id));
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Opprett og tildel oppgave
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Tittel <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Skriv inn oppgavetittel..."
                disabled={isSubmitting}
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beskriv oppgaven (valgfritt)..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* Priority and Deadline */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioritet</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    setFormData(prev => ({ ...prev, priority: value }))
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Lav</SelectItem>
                    <SelectItem value="medium">Middels</SelectItem>
                    <SelectItem value="high">Høy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frist</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  disabled={isSubmitting}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Selected Assignees Display */}
            <div className="space-y-2">
              <Label>Mottakere <span className="text-red-500">*</span></Label>
              
              {selectedAssignees.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-gray-50">
                  {selectedAssignees.map((assignee) => (
                    <Badge 
                      key={assignee.id} 
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {assignee.name}
                      <button
                        type="button"
                        onClick={() => removeAssignee(assignee.id)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAssigneeModal(true)}
                disabled={isSubmitting}
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                {selectedAssignees.length === 0 ? 'Velg mottakere' : 'Legg til flere mottakere'}
              </Button>
              <p className="text-xs text-muted-foreground">
                {selectedAssignees.length} {selectedAssignees.length === 1 ? 'bruker valgt' : 'brukere valgt'}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                <X className="h-4 w-4 mr-2" />
                Avbryt
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !formData.title.trim() || selectedAssignees.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Oppretter...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Opprett og tildel oppgave
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignee Selection Modal */}
      {showAssigneeModal && (
        <AssigneeSelectionModal
          isOpen={showAssigneeModal}
          onClose={() => setShowAssigneeModal(false)}
          onSelect={handleAssigneesSelected}
          selectedIds={selectedAssignees.map(a => a.id)}
        />
      )}
    </>
  );
}
