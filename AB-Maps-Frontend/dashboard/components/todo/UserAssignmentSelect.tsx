"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, User, Users, Shield, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { AssignableUser, fetchAssignableUsers } from '@/services/assignableUsersService';

interface UserAssignmentSelectProps {
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
  onPermissionResolved?: (canAssign: boolean) => void;
  disabled?: boolean;
}

export function UserAssignmentSelect({
  selectedUserIds,
  onSelectionChange,
  onPermissionResolved,
  disabled = false,
}: UserAssignmentSelectProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canAssign, setCanAssign] = useState<boolean | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAssignableUsers();
      setCanAssign(result.canAssign);
      setUsers(result.users);
      onPermissionResolved?.(result.canAssign);
    } catch (err) {
      console.error('Error loading assignable users:', err);
      setError('Failed to load users');
      setCanAssign(false);
      onPermissionResolved?.(false);
    } finally {
      setLoading(false);
    }
  }, [onPermissionResolved]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleUser = (userId: string) => {
    const next = selectedUserIds.includes(userId)
      ? selectedUserIds.filter(id => id !== userId)
      : [...selectedUserIds, userId];
    onSelectionChange(next);
  };

  const removeUser = (userId: string) => {
    onSelectionChange(selectedUserIds.filter(id => id !== userId));
  };

  const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));

  // While we are still checking permissions, render nothing
  if (loading || canAssign === null) {
    return null;
  }

  // Employee / unauthenticated — hide the entire section
  if (!canAssign) {
    return null;
  }

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'manager':
        return <Users className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getUserTypeBadgeClasses = (userType: string) => {
    switch (userType) {
      case 'admin':
        return 'bg-ab-info-bg text-ab-info border-ab-line-1';
      case 'manager':
        return 'bg-ab-accent-soft text-ab-accent border-ab-line-1';
      default:
        return 'bg-ab-success-bg text-ab-success border-ab-line-1';
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 bg-ab-elevated border-ab-line rounded-ab-md text-[13px]"
            disabled={disabled}
          >
            {selectedUsers.length === 0
              ? 'Velg brukere å tildele...'
              : `${selectedUsers.length} bruker${selectedUsers.length > 1 ? 'e' : ''} valgt`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Søk brukere..." />
            <CommandEmpty>
              {error || 'Ingen brukere funnet.'}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.name} ${user.email} ${user.username}`}
                  onSelect={() => toggleUser(user.id)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        selectedUserIds.includes(user.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-[13px]">{user.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 h-5 flex items-center gap-1 shrink-0 rounded-ab-xs',
                            getUserTypeBadgeClasses(user.user_type)
                          )}
                        >
                          {getUserTypeIcon(user.user_type)}
                          {user.type_label}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-ab-fg-3 truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected users chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 border border-ab-line-1 rounded-ab-md bg-ab-elevated">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="ab-pill"
            >
              {getUserTypeIcon(user.user_type)}
              <span>{user.name}</span>
              <button
                type="button"
                onClick={() => removeUser(user.id)}
                disabled={disabled}
                className="ml-0.5 text-ab-fg-3 hover:text-ab-fg transition-colors"
                aria-label={`Fjern ${user.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
