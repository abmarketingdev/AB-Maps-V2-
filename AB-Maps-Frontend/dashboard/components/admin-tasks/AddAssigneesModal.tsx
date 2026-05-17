"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addAssignees } from '@/services/adminTaskService';
import { fetchManagersAndAdmins, AssignableUser } from '@/services/userService';
import { 
  UserPlus, 
  X, 
  AlertTriangle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface AddAssigneesModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddAssigneesModal({
  taskId,
  isOpen,
  onClose,
  onSuccess,
}: AddAssigneesModalProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AssignableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = React.useRef(false);

  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen && !hasLoaded.current) {
      hasLoaded.current = true;
      loadAvailableUsers();
    }
    if (!isOpen) {
      hasLoaded.current = false;
      setSelectedUserIds([]);
      setError(null);
    }
  }, [isOpen]);

  const loadAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      setError(null);
      const users = await fetchManagersAndAdmins();
      setAvailableUsers(users);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Kunne ikke laste brukere. Vennligst prøv igjen.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (selectedUserIds.length === 0) {
      setError('Vennligst velg minst én bruker');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await addAssignees(taskId, { assignee_ids: selectedUserIds });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke legge til mottakere');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={isMobile ? 'max-w-[95vw] max-h-[85vh]' : 'max-w-lg max-h-[85vh]'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Legg til mottakere
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {loadingUsers ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Laster brukere...
            </div>
          ) : (
            <>
              <ScrollArea className="h-64 w-full rounded-md border p-4">
                <div className="space-y-3">
                  {availableUsers.map((user) => {
                    const userId = user.id; // Use database id
                    return (
                    <div
                      key={userId}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => toggleUser(userId)}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(userId)}
                        onCheckedChange={() => toggleUser(userId)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {user.name || user.first_name || user.username}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {user.user_type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selectedUserIds.length} {selectedUserIds.length === 1 ? 'bruker valgt' : 'brukere valgt'}
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedUserIds.length === 0}
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Legger til...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Legg til mottakere
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
