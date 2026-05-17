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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { removeAssignees } from '@/services/adminTaskService';
import { AssignedUser } from '@/types/todo';
import { 
  UserMinus, 
  X, 
  AlertTriangle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';

interface RemoveAssigneesModalProps {
  taskId: string;
  assignedUsers: AssignedUser[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoveAssigneesModal({
  taskId,
  assignedUsers,
  isOpen,
  onClose,
  onSuccess,
}: RemoveAssigneesModalProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!isOpen) {
      // Reset state when closing
      setSelectedUserIds([]);
      setError(null);
    }
  }, [isOpen]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (selectedUserIds.length === 0) {
      setError('Vennligst velg minst én bruker å fjerne');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await removeAssignees(taskId, { assignee_ids: selectedUserIds });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke fjerne mottakere');
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
            <UserMinus className="h-5 w-5" />
            Fjern mottakere
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

          {assignedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen mottakere å fjerne
            </div>
          ) : (
            <>
              <ScrollArea className="h-64 w-full rounded-md border p-4">
                <div className="space-y-3">
                  {assignedUsers.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                      onClick={() => toggleUser(user.user_id)}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.user_id)}
                        onCheckedChange={() => toggleUser(user.user_id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{user.user_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.user_type}
                          </Badge>
                          {user.status === 'completed' && (
                            <Badge variant="default" className="bg-green-500 text-xs">
                              Fullført
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Status: {user.status === 'completed' ? 'Fullført' : user.status === 'in_progress' ? 'Pågår' : 'Ventende'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selectedUserIds.length} {selectedUserIds.length === 1 ? 'bruker valgt for fjerning' : 'brukere valgt for fjerning'}
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
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedUserIds.length === 0}
          >
            {isSubmitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Fjerner...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Fjern mottakere
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
