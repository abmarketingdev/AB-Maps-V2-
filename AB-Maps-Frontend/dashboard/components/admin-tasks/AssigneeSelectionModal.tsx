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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchManagersAndAdmins, AssignableUser } from '@/services/userService';
import { Search, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SelectedAssignee {
  id: string;
  name: string;
  email: string;
}

interface AssigneeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (assignees: SelectedAssignee[]) => void;
  selectedIds: string[];
}

export function AssigneeSelectionModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  selectedIds 
}: AssigneeSelectionModalProps) {
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  // Load users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setSelected(new Set(selectedIds));
    }
  }, [isOpen, selectedIds]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchManagersAndAdmins();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Kunne ikke laste brukere');
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selectedUsers = users
      .filter(u => selected.has(u.id)) // Use the database id
      .map(u => ({
        id: u.id, // Use the database id (primary key)
        name: u.name || u.username,
        email: u.email
      }));
    onSelect(selectedUsers);
  };

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.name?.toLowerCase().includes(search)
    );
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Velg mottakere
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk etter navn eller e-post..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* User List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Laster brukere...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
              <Button variant="link" onClick={loadUsers} className="ml-2">
                Prøv igjen
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Ingen brukere funnet
            </div>
          ) : (
            <ScrollArea className="h-64 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredUsers.map((user) => {
                  const userId = user.id; // Use database id
                  const isSelected = selected.has(userId);
                  
                  return (
                    <div
                      key={userId}
                      className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleUser(userId)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUser(userId)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {user.name || user.username}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {user.user_type}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <p className="text-sm text-muted-foreground">
            {selected.size} {selected.size === 1 ? 'bruker valgt' : 'brukere valgt'}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Bekreft valg
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
