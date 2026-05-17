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
import { updateAdminTask } from '@/services/adminTaskService';
import { AdminAssignedTask, UpdateAdminTaskRequest } from '@/types/todo';
import { 
  Save, 
  X, 
  AlertTriangle,
  Clock,
  Calendar,
  Edit
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface UpdateTaskModalProps {
  task: AdminAssignedTask;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  deadline: string;
}

interface FormErrors {
  title?: string;
  deadline?: string;
  general?: string;
}

export function UpdateTaskModal({
  task,
  isOpen,
  onClose,
  onSuccess,
}: UpdateTaskModalProps) {
  const [formData, setFormData] = useState<FormData>({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (isOpen) {
      // Reset form data when modal opens
      setFormData({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
      });
      setErrors({});
    }
  }, [isOpen, task]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Tittel er påkrevd';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Tittel må være minst 3 tegn';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Tittel kan ikke være mer enn 200 tegn';
    }

    // Deadline validation (optional but if provided, must be valid)
    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      if (isNaN(deadlineDate.getTime())) {
        newErrors.deadline = 'Ugyldig dato';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});

      const updateData: UpdateAdminTaskRequest = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined,
      };

      await updateAdminTask(task.id, updateData);
      onSuccess();
      onClose();
      
    } catch (error) {
      console.error('Error updating task:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Kunne ikke oppdatere oppgave'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setErrors({});
    onClose();
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const descriptionLength = formData.description.length;
  const maxDescriptionLength = 2000;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className={`${
        isMobile 
          ? 'max-w-[95vw] mx-2 max-h-[85vh]' 
          : 'max-w-lg max-h-[90vh]'
      } overflow-y-auto`}>
        <DialogHeader className={isMobile ? 'pb-3' : ''}>
          <DialogTitle className={`flex items-center gap-2 ${
            isMobile ? 'text-lg' : 'text-xl'
          }`}>
            <Edit className="h-5 w-5" />
            Oppdater oppgave
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={isMobile ? 'space-y-4' : 'space-y-6'}>
          {/* Error Message */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{errors.general}</span>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Tittel <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Skriv inn oppgavetittel..."
              className={errors.title ? 'border-red-500' : ''}
              disabled={isSubmitting}
              maxLength={200}
              autoFocus
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.title.length}/200 tegn
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Beskrivelse
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Beskriv oppgaven (valgfritt)..."
              rows={4}
              disabled={isSubmitting}
              maxLength={maxDescriptionLength}
            />
            <p className="text-xs text-muted-foreground">
              {descriptionLength}/{maxDescriptionLength} tegn
            </p>
          </div>

          {/* Priority and Deadline */}
          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="space-y-2">
              <Label htmlFor="priority" className="text-sm font-medium">
                Prioritet
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  handleInputChange('priority', value)
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
              <Label htmlFor="deadline" className="text-sm font-medium">
                Frist
              </Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => handleInputChange('deadline', e.target.value)}
                className={errors.deadline ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.deadline && (
                <p className="text-sm text-red-600">{errors.deadline}</p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
            >
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Oppdaterer...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Oppdater oppgave
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
