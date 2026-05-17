"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * User information interface for the promotion modal
 */
export interface PromotionUserInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: "manager" | "employee" | "superuser";
}

/**
 * Promotion type enum
 */
export type PromotionType =
  | "employee-to-manager"
  | "manager-to-superuser"
  | "superuser-to-manager";

/**
 * Props for PromotionConfirmationModal component
 */
export interface PromotionConfirmationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** User information to display */
  user: PromotionUserInfo | null;
  /** Type of promotion action */
  promotionType: PromotionType | null;
  /** Whether the promotion is in progress (loading state) */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback when user confirms the promotion */
  onConfirm: (reason?: string) => void;
}

/**
 * Get the title text based on promotion type
 */
const getPromotionTitle = (type: PromotionType | null): string => {
  switch (type) {
    case "employee-to-manager":
      return "Promote Employee to Manager";
    case "manager-to-superuser":
      return "Promote Manager to Superuser";
    case "superuser-to-manager":
      return "Demote Superuser to Manager";
    default:
      return "Confirm Promotion";
  }
};

/**
 * Get the description text based on promotion type
 */
const getPromotionDescription = (type: PromotionType | null): string => {
  switch (type) {
    case "employee-to-manager":
      return "Are you sure you want to promote this employee to manager?";
    case "manager-to-superuser":
      return "Are you sure you want to promote this manager to superuser?";
    case "superuser-to-manager":
      return "Are you sure you want to demote this superuser to manager?";
    default:
      return "Are you sure you want to proceed?";
  }
};

/**
 * Get the current role display name
 */
const getRoleDisplayName = (type: "manager" | "employee" | "superuser"): string => {
  switch (type) {
    case "employee":
      return "Employee";
    case "manager":
      return "Manager";
    case "superuser":
      return "Superuser";
  }
};

/**
 * Get the new role display name based on promotion type
 */
const getNewRoleDisplayName = (type: PromotionType | null): string => {
  switch (type) {
    case "employee-to-manager":
      return "Manager";
    case "manager-to-superuser":
      return "Superuser";
    case "superuser-to-manager":
      return "Manager";
    default:
      return "Unknown";
  }
};

/**
 * Get the role badge color class
 */
const getRoleBadgeColor = (type: "manager" | "employee" | "superuser"): string => {
  switch (type) {
    case "employee":
      return "bg-ab-success/15 text-ab-success border border-ab-success/25";
    case "manager":
      return "bg-ab-accent/15 text-ab-accent border border-ab-accent/25";
    case "superuser":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25";
  }
};

/**
 * Promotion Confirmation Modal Component
 * 
 * A reusable modal component for confirming user role promotions.
 * Features:
 * - User information display
 * - Optional reason input field
 * - Loading and error states
 * - Keyboard navigation (ESC to close, Enter to confirm)
 * - Click outside to close
 * - Accessible (ARIA labels, focus management)
 */
export const PromotionConfirmationModal: React.FC<PromotionConfirmationModalProps> = ({
  isOpen,
  onClose,
  user,
  promotionType,
  isLoading = false,
  error = null,
  onConfirm,
}) => {
  const [reason, setReason] = useState("");
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset reason when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReason("");
    }
  }, [isOpen]);

  // Focus management: focus on reason textarea when modal opens
  useEffect(() => {
    if (isOpen && reasonTextareaRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        reasonTextareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle confirm button click
  const handleConfirm = useCallback(() => {
    if (isLoading) return;
    onConfirm(reason.trim() || undefined);
  }, [isLoading, onConfirm, reason]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
      // Ctrl+Enter to confirm
      if (e.key === "Enter" && e.ctrlKey && !isLoading) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose, handleConfirm]);

  // Don't render if modal is not open
  if (!isOpen || !user || !promotionType) {
    return null;
  }

  const title = getPromotionTitle(promotionType);
  const description = getPromotionDescription(promotionType);
  const currentRole = getRoleDisplayName(user.type);
  const newRole = getNewRoleDisplayName(promotionType);
  const roleBadgeColor = getRoleBadgeColor(user.type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-modal-title"
      aria-describedby="promotion-modal-description"
    >
      <div
        ref={modalRef}
        className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-ab-fg-3 hover:text-ab-fg text-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Close modal"
          type="button"
        >
          &times;
        </button>

        {/* Title */}
        <h2
          id="promotion-modal-title"
          className="text-2xl font-bold mb-4 text-center text-ab-fg"
        >
          {title}
        </h2>

        {/* Description */}
        <p
          id="promotion-modal-description"
          className="text-ab-fg-2 text-center mb-6"
        >
          {description}
        </p>

        {/* User Information Card */}
        <div className="bg-ab-subtle/40 rounded-xl p-6 mb-6 border border-ab-line-1">
          <div className="space-y-3">
            {/* User Name */}
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow ${roleBadgeColor}`}
                aria-label={`User avatar for ${user.name}`}
              >
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg text-ab-fg">{user.name}</div>
                <div className="text-sm text-ab-fg-3">{user.email}</div>
              </div>
            </div>

            {/* Role Information */}
            <div className="flex items-center gap-4 pt-3 border-t border-ab-line-1">
              <div className="flex-1">
                <div className="text-xs text-ab-fg-3 mb-1">Current Role</div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${roleBadgeColor}`}
                >
                  {currentRole}
                </span>
              </div>
              <div className="text-ab-fg-3 text-xl">➡️</div>
              <div className="flex-1">
                <div className="text-xs text-ab-fg-3 mb-1">New Role</div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${
                    newRole === "Manager"
                      ? "bg-ab-accent/15 text-ab-accent border border-ab-accent/25"
                      : "bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25"
                  }`}
                >
                  {newRole}
                </span>
              </div>
            </div>

            {/* Phone (if available) */}
            {user.phone && (
              <div className="text-sm text-ab-fg-2 pt-2">
                <span className="font-medium">Phone:</span> {user.phone}
              </div>
            )}
          </div>
        </div>

        {/* Reason Input Field */}
        <div className="mb-6">
          <label
            htmlFor="promotion-reason"
            className="block text-sm font-medium text-ab-fg-2 mb-2"
          >
            Reason (Optional)
          </label>
          <textarea
            id="promotion-reason"
            ref={reasonTextareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for promotion (for audit trail)..."
            className="w-full rounded-lg border border-ab-line bg-ab-elevated text-ab-fg placeholder:text-ab-fg-3 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ab-accent/20 focus:border-ab-accent disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            rows={4}
            disabled={isLoading}
            aria-describedby="promotion-reason-help"
          />
          <p
            id="promotion-reason-help"
            className="text-xs text-ab-fg-3 mt-1"
          >
            This reason will be recorded in the audit trail.
          </p>
        </div>

        {/* Warning Message */}
        <div className="bg-ab-warning-bg/40 border border-ab-warning/25 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <span className="text-ab-warning text-lg">⚠️</span>
            <p className="text-sm text-ab-warning">
              This action cannot be undone. Please confirm that you want to proceed.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-ab-danger-bg/40 border border-ab-danger/25 rounded-lg p-3 mb-6 animate-fade-in">
            <div className="flex items-start gap-2">
              <span className="text-ab-danger text-lg">❌</span>
              <p className="text-sm text-ab-danger">{error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-lg border border-ab-line bg-ab-elevated text-ab-fg-2 hover:text-ab-fg font-medium hover:bg-ab-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-ab-accent/20"
            type="button"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-lg font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              promotionType === "superuser-to-manager"
                ? "bg-orange-500 hover:bg-orange-600 focus:ring-orange-300"
                : promotionType === "manager-to-superuser"
                ? "bg-purple-500 hover:bg-purple-600 focus:ring-purple-300"
                : "bg-blue-500 hover:bg-blue-600 focus:ring-blue-300"
            }`}
            type="button"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromotionConfirmationModal;
