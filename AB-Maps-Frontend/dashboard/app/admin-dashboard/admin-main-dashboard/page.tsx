"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchManagers, fetchEmployees, registerUser, updateManager, updateEmployee, deleteManager, deleteEmployee } from "../adminServices";
import { createSuperuser, getSuperusers, updateSuperuser, deleteSuperuser, type Superuser } from "../../../services/superuserService";
import { sendWelcomeEmail } from "../../../services/emailService";
import { adminAuthService } from "@/lib/auth/adminAuthService";
import { useRouter } from "next/navigation";
import { PromotionConfirmationModal, type PromotionUserInfo, type PromotionType } from "@/components/admin/PromotionConfirmationModal";
import {
  promoteEmployeeToManager,
  promoteManagerToSuperuser,
  demoteSuperuserToManager,
  PromotionError,
  getErrorMessage,
} from "@/services/userPromotionService";
import { PageHeader, ThemeToggle } from "@/components/ui-ab";
import { cn } from "@/lib/utils";
import { stringToHsl } from "@/lib/stringToHsl";
import { useTheme } from "next-themes";
import { toast } from "@/components/ui/use-toast";
import {
  Users as UsersIcon,
  UserCog,
  User as UserIcon,
  UserPlus,
  ShieldCheck,
  BookOpen,
  ArrowUpRight,
  Search,
  X as XIcon,
  Pencil,
  Trash2,
  Phone,
  IdCard,
  UserX,
  ChevronUp,
  ChevronDown,
  Star,
  Copy,
  LogOut,
  UserCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MANAGER_COLOR = "bg-blue-100 text-blue-700";
const EMPLOYEE_COLOR = "bg-green-100 text-green-700";

interface UserCard {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "manager" | "employee" | "superuser";
  manager_id?: string;
  ab_person_id?: string | null;
  /** From linked User; false if unlinked or absent in API response */
  is_sales_chief?: boolean;
}

const getAdminName = () => {
  if (typeof window !== "undefined") {
    try {
      const data = localStorage.getItem("admin_user_data");
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.name || "Admin";
      }
    } catch {}
  }
  return "Admin";
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

// Validation helper for AB Person ID
const validatePersonId = (value: string): string | null => {
  // Empty is OK (optional field)
  if (!value || value.trim() === '') {
    return null;
  }
  
  // Must be exactly 4 digits
  if (!/^\d{4}$/.test(value.trim())) {
    return 'Person ID must be exactly 4 digits (0000-9999)';
  }
  
  // Valid
  return null;
};

// Patch registerUser to handle non-JSON error responses
async function robustRegisterUser(payload: any) {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiBase}/api/users/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      // Try to parse as text for unique constraint errors
      const text = await res.text();
      if (text.includes("unique constraint") || text.includes("duplicate key")) {
        return { ok: false, data: { username: "Username already exists. Please choose another." } };
      }
      return { ok: false, data: { error: text || "Unknown error" } };
    }
    // Also check for unique constraint in data.error/message
    if (!res.ok && (data?.error || data?.message)) {
      const msg = data.error || data.message;
      if (msg && (msg.includes("unique constraint") || msg.includes("duplicate key"))) {
        return { ok: false, data: { username: "Username already exists. Please choose another." } };
      }
    }
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, data: { error: "Network error. Please try again." } };
  }
}

const AdminMainDashboard: React.FC = () => {
  const router = useRouter();
  const [users, setUsers] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "manager" | "employee" | "superuser">("all");
  const [search, setSearch] = useState("");
  const adminName = getAdminName();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateManager, setShowCreateManager] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
    ab_person_id: "",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [empForm, setEmpForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
    ab_person_id: "",
    employee_type: "maps_emp", // Default to maps_emp
  });
  const [empFormError, setEmpFormError] = useState("");
  const [empFormSuccess, setEmpFormSuccess] = useState("");
  const [empFormLoading, setEmpFormLoading] = useState(false);
  const empFirstInputRef = useRef<HTMLInputElement>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<{ [key: string]: string }>({});
  const [empFormFieldErrors, setEmpFormFieldErrors] = useState<{ [key: string]: string }>({});

  // Superuser management states
  const [showCreateSuperuser, setShowCreateSuperuser] = useState(false);
  const [superuserForm, setSuperuserForm] = useState({
    username: "",
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
    ab_person_id: "",
    admin_type: "maps_admin", // Default to maps_admin
  });
  const [superuserFormError, setSuperuserFormError] = useState("");
  const [superuserFormSuccess, setSuperuserFormSuccess] = useState("");
  const [superuserFormLoading, setSuperuserFormLoading] = useState(false);
  const [superuserFormFieldErrors, setSuperuserFormFieldErrors] = useState<{ [key: string]: string }>({});
  const superuserFirstInputRef = useRef<HTMLInputElement>(null);

  // Promotion modal states
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [selectedUserForPromotion, setSelectedUserForPromotion] = useState<UserCard | null>(null);
  const [promotionType, setPromotionType] = useState<PromotionType | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionSuccess, setPromotionSuccess] = useState<string | null>(null);

  // Superuser password validation
  const superuserPasswordValid =
    /[A-Z]/.test(superuserForm.password) &&
    /[0-9]/.test(superuserForm.password) &&
    /[^A-Za-z0-9]/.test(superuserForm.password) &&
    superuserForm.password.length >= 8;

  const handleSuperuserFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSuperuserFormError("");
    setSuperuserFormSuccess("");
    setSuperuserFormFieldErrors({ ...superuserFormFieldErrors, [e.target.name]: "" });
    
    // Sanitize ab_person_id to only allow digits
    if (e.target.name === 'ab_person_id') {
      const sanitized = e.target.value.replace(/\D/g, '').slice(0, 4);
      setSuperuserForm({ ...superuserForm, [e.target.name]: sanitized });
    } else {
      setSuperuserForm({ ...superuserForm, [e.target.name]: e.target.value });
    }
  };

  const handleCreateSuperuserOpen = () => {
    setShowCreateSuperuser(true);
    setTimeout(() => superuserFirstInputRef.current?.focus(), 100);
  };

  const handleCreateSuperuserClose = () => {
    setShowCreateSuperuser(false);
    setSuperuserForm({ username: "", email: "", password: "", password_confirm: "", first_name: "", last_name: "", ab_person_id: "", admin_type: "maps_admin" });
    setSuperuserFormError("");
    setSuperuserFormSuccess("");
    setSuperuserFormLoading(false);
    setSuperuserFormFieldErrors({});
  };

  const handleCreateSuperuserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuperuserFormError("");
    setSuperuserFormSuccess("");
    setSuperuserFormFieldErrors({});
    let hasError = false;
    const newFieldErrors: { [key: string]: string } = {};
    ["username", "email", "password", "password_confirm", "first_name", "last_name"].forEach(field => {
      if (!superuserForm[field as keyof typeof superuserForm]) {
        newFieldErrors[field] = "This field is required.";
        hasError = true;
      }
    });
    
    // Validate ab_person_id if provided
    const superuserPersonIdError = validatePersonId(superuserForm.ab_person_id);
    if (superuserPersonIdError) {
      newFieldErrors["ab_person_id"] = superuserPersonIdError;
      hasError = true;
    }
    
    if (!superuserPasswordValid) {
      newFieldErrors["password"] = "Password must be at least 8 characters, include 1 uppercase, 1 number, 1 special character.";
      hasError = true;
    }
    if (superuserForm.password !== superuserForm.password_confirm) {
      newFieldErrors["password_confirm"] = "Passwords do not match.";
      hasError = true;
    }
    if (hasError) {
      setSuperuserFormFieldErrors(newFieldErrors);
      return;
    }
    setSuperuserFormLoading(true);
    try {
      const newSuperuser = await createSuperuser({
        username: superuserForm.username,
        email: superuserForm.email,
        password: superuserForm.password,
        password_confirm: superuserForm.password_confirm,
        first_name: superuserForm.first_name,
        last_name: superuserForm.last_name,
        user_type: "superuser",
        admin_type: superuserForm.admin_type || "maps_admin", // Default to maps_admin if not set
        ab_person_id: superuserForm.ab_person_id.trim() || undefined,
      });
      
      // Send welcome email
      try {
        await sendWelcomeEmail({
          receiver_email: superuserForm.email,
          password: superuserForm.password,
          user_type: "superuser",
          user_name: superuserForm.username,
        });
        setSuperuserFormSuccess("Superuser created successfully and welcome email sent!");
      } catch (emailError: any) {
        console.error("Failed to send welcome email:", emailError);
        setSuperuserFormSuccess("Superuser created successfully, but failed to send welcome email.");
      }
      
      // Add the new superuser to the list
      const newSuperuserCard: UserCard = {
        id: newSuperuser.id,
        name: `${newSuperuser.first_name} ${newSuperuser.last_name}`,
        email: newSuperuser.email,
        phone: "N/A",
        type: "superuser",
        is_sales_chief: Boolean(newSuperuser.is_sales_chief),
      };
      setUsers(prevUsers => [...prevUsers, newSuperuserCard]);
      setTimeout(() => handleCreateSuperuserClose(), 1200);
    } catch (err: any) {
      setSuperuserFormError(err.message || "Failed to create superuser. Please try again.");
    } finally {
      setSuperuserFormLoading(false);
    }
  };

  // Edit modal states
  const [showEditManager, setShowEditManager] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [showEditSuperuser, setShowEditSuperuser] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    ab_person_id: "",
    is_sales_chief: false,
  });
  const [editFormError, setEditFormError] = useState("");
  const [editFormSuccess, setEditFormSuccess] = useState("");
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserCard | null>(null);
  const [editFormFieldErrors, setEditFormFieldErrors] = useState<{ [key: string]: string }>({});

  // Delete confirmation modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserCard | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Profile modal states
  const [showProfile, setShowProfile] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);

  /** Avoid hydration mismatch: server cannot read localStorage; defer auth until client mount. */
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionAuthed, setSessionAuthed] = useState(false);

  // Employee password validation
  const empPasswordValid =
    /[A-Z]/.test(empForm.password) &&
    /[0-9]/.test(empForm.password) &&
    /[^A-Za-z0-9]/.test(empForm.password) &&
    empForm.password.length >= 8;

  const handleEmpFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEmpFormError("");
    setEmpFormSuccess("");
    setEmpFormFieldErrors({ ...empFormFieldErrors, [e.target.name]: "" });
    
    // Sanitize ab_person_id to only allow digits
    if (e.target.name === 'ab_person_id') {
      const sanitized = e.target.value.replace(/\D/g, '').slice(0, 4);
      setEmpForm({ ...empForm, [e.target.name]: sanitized });
    } else {
      setEmpForm({ ...empForm, [e.target.name]: e.target.value });
    }
  };

  const handleCreateEmployeeOpen = () => {
    setShowCreateEmployee(true);
    setTimeout(() => empFirstInputRef.current?.focus(), 100);
  };

  const handleCreateEmployeeClose = () => {
    setShowCreateEmployee(false);
    setEmpForm({ username: "", email: "", password: "", password_confirm: "", first_name: "", last_name: "", ab_person_id: "", employee_type: "maps_emp" });
    setEmpFormError("");
    setEmpFormSuccess("");
    setEmpFormLoading(false);
    setEmpFormFieldErrors({});
  };

  const handleCreateEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpFormError("");
    setEmpFormSuccess("");
    setEmpFormFieldErrors({});
    let hasError = false;
    const newFieldErrors: { [key: string]: string } = {};
    ["username", "email", "password", "password_confirm", "first_name", "last_name"].forEach(field => {
      if (!empForm[field as keyof typeof empForm]) {
        newFieldErrors[field] = "This field is required.";
        hasError = true;
      }
    });
    
    // Validate ab_person_id if provided
    const empPersonIdError = validatePersonId(empForm.ab_person_id);
    if (empPersonIdError) {
      newFieldErrors["ab_person_id"] = empPersonIdError;
      hasError = true;
    }
    
    if (!empPasswordValid) {
      newFieldErrors["password"] = "Password must be at least 8 characters, include 1 uppercase, 1 number, 1 special character.";
      hasError = true;
    }
    if (empForm.password !== empForm.password_confirm) {
      newFieldErrors["password_confirm"] = "Passwords do not match.";
      hasError = true;
    }
    if (hasError) {
      setEmpFormFieldErrors(newFieldErrors);
      return;
    }
    setEmpFormLoading(true);
    try {
      const payload = {
        ...empForm,
        user_type: "employee",
        employee_type: empForm.employee_type || "maps_emp", // Default to maps_emp if not set
        ab_person_id: empForm.ab_person_id.trim() || undefined,
      };
      const { ok, data } = await registerUser(payload);
      if (!ok) {
        let fieldErrors: { [key: string]: string } = {};
        if (data.username) fieldErrors.username = data.username;
        if (data.email) fieldErrors.email = data.email;
        if (data.password) fieldErrors.password = data.password;
        if (data.ab_person_id) fieldErrors.ab_person_id = Array.isArray(data.ab_person_id) ? data.ab_person_id[0] : data.ab_person_id;
        if (Object.keys(fieldErrors).length > 0) {
          setEmpFormFieldErrors(fieldErrors);
        } else {
          setEmpFormError(data.error || data.message || "Registration failed.");
        }
        setEmpFormLoading(false);
        return;
      }
      
      // Send welcome email
      try {
        await sendWelcomeEmail({
          receiver_email: empForm.email,
          password: empForm.password,
          user_type: "employee",
          user_name: empForm.username,
        });
        setEmpFormSuccess("Employee registered successfully and welcome email sent!");
      } catch (emailError: any) {
        console.error("Failed to send welcome email:", emailError);
        setEmpFormSuccess("Employee registered successfully, but failed to send welcome email.");
      }
      
      setTimeout(() => handleCreateEmployeeClose(), 1200);
    } catch (err) {
      setEmpFormError("Network error. Please try again.");
    } finally {
      setEmpFormLoading(false);
    }
  };

  // Load users function (reusable)
  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const [mgrs, emps, superusers] = await Promise.all([
        fetchManagers(),
        fetchEmployees(),
        getSuperusers(),
      ]);
      const managerCards = mgrs.map((m: any) => ({ 
        ...m, 
        type: "manager" as const,
        phone: m.phone || "",
        ab_person_id: m.ab_person_id || null,
        is_sales_chief: Boolean(m.is_sales_chief),
      }));
      const employeeCards = emps.map((e: any) => ({ 
        ...e, 
        type: "employee" as const,
        phone: e.phone || "",
        ab_person_id: e.ab_person_id || null,
        is_sales_chief: Boolean(e.is_sales_chief),
      }));
      const superuserCards = superusers.map((s: Superuser) => ({ 
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        email: s.email,
        phone: "N/A", // Superusers don't have phone numbers
        type: "superuser" as const,
        ab_person_id: (s as any).ab_person_id || null,
        is_sales_chief: Boolean(s.is_sales_chief),
      }));
      setUsers([...managerCards, ...employeeCards, ...superuserCards]);
    } catch (err: any) {
      // Check if it's an authentication error
      if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        // Redirect to login page
        router.push('/admin-dashboard');
        return;
      }
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ok = adminAuthService.isAuthenticated();
    setSessionAuthed(ok);
    setAuthChecked(true);
    if (!ok) {
      router.push("/admin-dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (!authChecked || !sessionAuthed) return;
    loadUsers();
  }, [authChecked, sessionAuthed, router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.admin-avatar-dropdown')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-dismiss success toast after 5 seconds
  useEffect(() => {
    if (promotionSuccess) {
      const timer = setTimeout(() => {
        setPromotionSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [promotionSuccess]);

  // ⌘N / Ctrl+N → opens "Ny leder" create modal (mirrors the kbd hint)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        // Skip when any modal is already open
        if (
          showCreateManager ||
          showCreateEmployee ||
          showCreateSuperuser ||
          showEditManager ||
          showEditEmployee ||
          showEditSuperuser ||
          showDeleteConfirm
        ) {
          return;
        }
        e.preventDefault();
        handleCreateManagerOpen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showCreateManager,
    showCreateEmployee,
    showCreateSuperuser,
    showEditManager,
    showEditEmployee,
    showEditSuperuser,
    showDeleteConfirm,
  ]);

  // Same shell on server and first client paint; real auth only after mount
  if (!authChecked || !sessionAuthed) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 via-white to-blue-50 font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    if (filter !== "all" && u.type !== filter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const nameMatch = u.name?.toLowerCase().includes(searchLower) || false;
      const emailMatch = u.email?.toLowerCase().includes(searchLower) || false;
      const personIdMatch = u.ab_person_id?.includes(search) || false;
      
      if (!nameMatch && !emailMatch && !personIdMatch) return false;
    }
    return true;
  });

  // Placeholder handlers
  const handleEdit = (user: UserCard) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      ab_person_id: user.ab_person_id || "",
      is_sales_chief: Boolean(user.is_sales_chief),
    });
    setEditFormError("");
    setEditFormSuccess("");
    setEditFormFieldErrors({});
    
    if (user.type === "manager") {
      setShowEditManager(true);
    } else if (user.type === "employee") {
      setShowEditEmployee(true);
    } else {
      setShowEditSuperuser(true);
    }
  };
  const handleDelete = (user: UserCard) => {
    setDeletingUser(user);
    setDeleteError("");
    setShowDeleteConfirm(true);
  };

  const handleDeleteClose = () => {
    setShowDeleteConfirm(false);
    setDeletingUser(null);
    setDeleteError("");
    setDeleteLoading(false);
  };

  // Promotion handlers
  const handlePromoteEmployee = (user: UserCard) => {
    if (user.type !== "employee") return;
    setSelectedUserForPromotion(user);
    setPromotionType("employee-to-manager");
    setPromotionError(null);
    setPromotionSuccess(null);
    setShowPromotionModal(true);
  };

  const handlePromoteManager = (user: UserCard) => {
    if (user.type !== "manager") return;
    setSelectedUserForPromotion(user);
    setPromotionType("manager-to-superuser");
    setPromotionError(null);
    setPromotionSuccess(null);
    setShowPromotionModal(true);
  };

  const handleDemoteSuperuser = (user: UserCard) => {
    if (user.type !== "superuser") return;
    setSelectedUserForPromotion(user);
    setPromotionType("superuser-to-manager");
    setPromotionError(null);
    setPromotionSuccess(null);
    setShowPromotionModal(true);
  };

  const handlePromotionClose = () => {
    setShowPromotionModal(false);
    setSelectedUserForPromotion(null);
    setPromotionType(null);
    setPromotionError(null);
    setPromotionSuccess(null);
    setPromotionLoading(false);
  };

  const handlePromotionConfirm = async (reason?: string) => {
    if (!selectedUserForPromotion || !promotionType) return;

    setPromotionLoading(true);
    setPromotionError(null);
    setPromotionSuccess(null);

    try {
      let response;
      let newRole: string;
      
      if (promotionType === "employee-to-manager") {
        response = await promoteEmployeeToManager(selectedUserForPromotion.id, reason);
        newRole = "Manager";
      } else if (promotionType === "manager-to-superuser") {
        response = await promoteManagerToSuperuser(selectedUserForPromotion.id, reason);
        newRole = "Superuser";
      } else if (promotionType === "superuser-to-manager") {
        response = await demoteSuperuserToManager(selectedUserForPromotion.id, reason);
        newRole = "Manager";
      } else {
        throw new Error("Invalid promotion type");
      }

      // Build success message with user details
      const userName = selectedUserForPromotion.name;
      const successMessage = `${userName} has been successfully promoted to ${newRole}!`;
      
      // Close modal first (but keep success message)
      setShowPromotionModal(false);
      setSelectedUserForPromotion(null);
      setPromotionType(null);
      setPromotionError(null);
      setPromotionLoading(false);
      
      // Show success message
      setPromotionSuccess(successMessage);
      
      // Refresh user list
      await loadUsers();
    } catch (error) {
      console.error("Promotion error:", error);
      
      // Enhanced error handling with specific messages
      if (error instanceof PromotionError) {
        const errorMessage = getErrorMessage(error.code) || error.message;
        setPromotionError(errorMessage);
      } else {
        const errorMessage = error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.";
        setPromotionError(errorMessage);
      }
      // Keep modal open on error so user can retry or cancel
    } finally {
      setPromotionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      let success;
      if (deletingUser.type === "manager") {
        success = await deleteManager(deletingUser.id);
      } else if (deletingUser.type === "employee") {
        success = await deleteEmployee(deletingUser.id);
      } else if (deletingUser.type === "superuser") {
        success = await deleteSuperuser(deletingUser.id);
      } else {
        setDeleteError("Unknown user type. Cannot delete.");
        setDeleteLoading(false);
        return;
      }

      if (success) {
        // Remove the user from the local state
        setUsers(prevUsers => prevUsers.filter(user => user.id !== deletingUser.id));
        handleDeleteClose();
      } else {
        setDeleteError("Failed to delete user. Please try again.");
      }
    } catch (err: any) {
      // Check if it's an authentication error
      if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        router.push('/admin-dashboard');
        return;
      }
      setDeleteError(err.message || "Failed to delete user. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };
  const handleCreateManager = () => alert("Create Manager (not implemented)");
  const handleCreateEmployee = () => alert("Create Employee (not implemented)");
  const handleProfile = () => {
    const userData = adminAuthService.getUserData();
    setAdminData(userData);
    setShowProfile(true);
    setShowDropdown(false);
  };

  const handleProfileClose = () => {
    setShowProfile(false);
    setAdminData(null);
  };

  const handleLogout = async () => {
    try {
      await adminAuthService.logout();
      router.push('/admin-dashboard');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local data and redirect
      router.push('/admin-dashboard');
    }
  };

  // Password validation
  const passwordValid =
    /[A-Z]/.test(form.password) &&
    /[0-9]/.test(form.password) &&
    /[^A-Za-z0-9]/.test(form.password) &&
    form.password.length >= 8;

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError("");
    setFormSuccess("");
    setFormFieldErrors({ ...formFieldErrors, [e.target.name]: "" });
    
    // Sanitize ab_person_id to only allow digits
    if (e.target.name === 'ab_person_id') {
      const sanitized = e.target.value.replace(/\D/g, '').slice(0, 4);
      setForm({ ...form, [e.target.name]: sanitized });
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  const handleCreateManagerOpen = () => {
    setShowCreateManager(true);
    setTimeout(() => firstInputRef.current?.focus(), 100);
  };

  const handleCreateManagerClose = () => {
    setShowCreateManager(false);
    setForm({ username: "", email: "", password: "", password_confirm: "", first_name: "", last_name: "", ab_person_id: "" });
    setFormError("");
    setFormSuccess("");
    setFormLoading(false);
    setFormFieldErrors({});
  };

  const handleCreateManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setFormFieldErrors({});
    let hasError = false;
    const newFieldErrors: { [key: string]: string } = {};
    ["username", "email", "password", "password_confirm", "first_name", "last_name"].forEach(field => {
      if (!form[field as keyof typeof form]) {
        newFieldErrors[field] = "This field is required.";
        hasError = true;
      }
    });
    
    // Validate ab_person_id if provided
    const personIdError = validatePersonId(form.ab_person_id);
    if (personIdError) {
      newFieldErrors["ab_person_id"] = personIdError;
      hasError = true;
    }
    
    if (!passwordValid) {
      newFieldErrors["password"] = "Password must be at least 8 characters, include 1 uppercase, 1 number, 1 special character.";
      hasError = true;
    }
    if (form.password !== form.password_confirm) {
      newFieldErrors["password_confirm"] = "Passwords do not match.";
      hasError = true;
    }
    if (hasError) {
      setFormFieldErrors(newFieldErrors);
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        ...form,
        user_type: "manager",
        ab_person_id: form.ab_person_id.trim() || undefined,
      };
      const { ok, data } = await registerUser(payload);
      if (!ok) {
        let fieldErrors: { [key: string]: string } = {};
        if (data.username) fieldErrors.username = data.username;
        if (data.email) fieldErrors.email = data.email;
        if (data.password) fieldErrors.password = data.password;
        if (data.ab_person_id) fieldErrors.ab_person_id = Array.isArray(data.ab_person_id) ? data.ab_person_id[0] : data.ab_person_id;
        if (Object.keys(fieldErrors).length > 0) {
          setFormFieldErrors(fieldErrors);
        } else {
          setFormError(data.error || data.message || "Registration failed.");
        }
        setFormLoading(false);
        return;
      }
      
      // Send welcome email
      try {
        await sendWelcomeEmail({
          receiver_email: form.email,
          password: form.password,
          user_type: "manager",
          user_name: form.username,
        });
        setFormSuccess("Manager registered successfully and welcome email sent!");
      } catch (emailError: any) {
        console.error("Failed to send welcome email:", emailError);
        setFormSuccess("Manager registered successfully, but failed to send welcome email.");
      }
      
      setTimeout(() => handleCreateManagerClose(), 1200);
    } catch (err) {
      setFormError("Network error. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditClose = () => {
    setShowEditManager(false);
    setShowEditEmployee(false);
    setShowEditSuperuser(false);
    setEditingUser(null);
    setEditForm({ name: "", email: "", phone: "", ab_person_id: "", is_sales_chief: false });
    setEditFormError("");
    setEditFormSuccess("");
    setEditFormLoading(false);
    setEditFormFieldErrors({});
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormError("");
    setEditFormSuccess("");
    setEditFormFieldErrors({ ...editFormFieldErrors, [e.target.name]: "" });
    
    // Sanitize ab_person_id to only allow digits
    if (e.target.name === 'ab_person_id') {
      const sanitized = e.target.value.replace(/\D/g, '').slice(0, 4);
      setEditForm({ ...editForm, ab_person_id: sanitized });
    } else if (e.target.name === "is_sales_chief") {
      setEditForm({ ...editForm, is_sales_chief: e.target.checked });
    } else {
      setEditForm({ ...editForm, [e.target.name]: e.target.value });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError("");
    setEditFormSuccess("");
    setEditFormFieldErrors({});
    
    if (!editingUser) return;

    // Validation
    let hasError = false;
    const newFieldErrors: { [key: string]: string } = {};
    
    if (!editForm.name.trim()) {
      newFieldErrors.name = "Name is required.";
      hasError = true;
    }
    if (!editForm.email.trim()) {
      newFieldErrors.email = "Email is required.";
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(editForm.email)) {
      newFieldErrors.email = "Please enter a valid email address.";
      hasError = true;
    }
    if (editingUser.type !== "superuser" && !editForm.phone.trim()) {
      newFieldErrors.phone = "Phone number is required.";
      hasError = true;
    }
    
    // Validate ab_person_id if provided
    const editPersonIdError = validatePersonId(editForm.ab_person_id);
    if (editPersonIdError) {
      newFieldErrors.ab_person_id = editPersonIdError;
      hasError = true;
    }

    if (hasError) {
      setEditFormFieldErrors(newFieldErrors);
      return;
    }

    setEditFormLoading(true);
    try {
      let result;
      if (editingUser.type === "manager") {
        const payload = {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          ab_person_id: editForm.ab_person_id.trim() || null,
          is_sales_chief: editForm.is_sales_chief,
        };
        result = await updateManager(editingUser.id, payload);
      } else if (editingUser.type === "employee") {
        const payload = {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          ab_person_id: editForm.ab_person_id.trim() || null,
          is_sales_chief: editForm.is_sales_chief,
        };
        result = await updateEmployee(editingUser.id, payload);
      } else if (editingUser.type === "superuser") {
        const [firstName, ...lastNameParts] = editForm.name.trim().split(' ');
        const lastName = lastNameParts.join(' ');
        const payload = {
          first_name: firstName,
          last_name: lastName,
          email: editForm.email.trim(),
          is_sales_chief: editForm.is_sales_chief,
        };
        result = await updateSuperuser(editingUser.id, payload);
      } else {
        setEditFormError("Unknown user type. Cannot update.");
        setEditFormLoading(false);
        return;
      }

      setEditFormSuccess(`${editingUser.type === "manager" ? "Manager" : editingUser.type === "employee" ? "Employee" : "Superuser"} updated successfully!`);
      
      const nextSalesChief =
        typeof result?.is_sales_chief === "boolean" ? result.is_sales_chief : editForm.is_sales_chief;

      // Update the user in the local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id 
            ? { 
                ...user, 
                name:
                  editingUser.type === "superuser" && result?.first_name != null
                    ? `${result.first_name} ${result.last_name || ""}`.trim()
                    : editForm.name.trim(),
                email: result?.email ?? editForm.email.trim(),
                ab_person_id:
                  editingUser.type === "superuser"
                    ? user.ab_person_id
                    : editForm.ab_person_id.trim() || null,
                is_sales_chief: nextSalesChief,
              }
            : user
        )
      );

      setTimeout(() => handleEditClose(), 1200);
    } catch (err: any) {
      // Check if it's an authentication error
      if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        router.push('/admin-dashboard');
        return;
      }
      setEditFormError(err.message || "Failed to update user. Please try again.");
    } finally {
      setEditFormLoading(false);
    }
  };

  // Per-role counts (derived from full users list, ignoring filter/search)
  const allCount = users.length;
  const managerCount = users.filter(u => u.type === "manager").length;
  const employeeCount = users.filter(u => u.type === "employee").length;
  const superuserCount = users.filter(u => u.type === "superuser").length;

  return (
    <DashboardShell
      adminName={adminName}
      showDropdown={showDropdown}
      setShowDropdown={setShowDropdown}
      onProfile={handleProfile}
      onLogout={handleLogout}
      onCreateManager={handleCreateManagerOpen}
      onCreateEmployee={handleCreateEmployeeOpen}
      onCreateSuperuser={handleCreateSuperuserOpen}
      onLearning={() => router.push("/learning-platform")}
      totalCount={allCount}
    >
      {/* KPI stat strip — admin-page signal */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          active={filter === "all"}
          onClick={() => setFilter("all")}
          icon={UsersIcon}
          label="TOTALT BRUKERE"
          value={allCount}
          tint="neutral"
        />
        <KpiCard
          active={filter === "manager"}
          onClick={() => setFilter("manager")}
          icon={UserCog}
          label="LEDERE"
          value={managerCount}
          tint="accent"
        />
        <KpiCard
          active={filter === "employee"}
          onClick={() => setFilter("employee")}
          icon={UserIcon}
          label="ANSATTE"
          value={employeeCount}
          tint="success"
        />
        <KpiCard
          active={filter === "superuser"}
          onClick={() => setFilter("superuser")}
          icon={ShieldCheck}
          label="SUPERBRUKERE"
          value={superuserCount}
          tint="purple"
        />
      </div>

      {/* Filter + search strip */}
      <div className="mt-4 bg-ab-elevated border border-ab-line rounded-xl p-1.5 flex items-center gap-1">
        <FilterTab
          active={filter === "all"}
          onClick={() => setFilter("all")}
          icon={UsersIcon}
          label="Alle"
          count={allCount}
        />
        <FilterTab
          active={filter === "manager"}
          onClick={() => setFilter("manager")}
          icon={UserCog}
          label="Ledere"
          count={managerCount}
        />
        <FilterTab
          active={filter === "employee"}
          onClick={() => setFilter("employee")}
          icon={UserIcon}
          label="Ansatte"
          count={employeeCount}
        />
        <FilterTab
          active={filter === "superuser"}
          onClick={() => setFilter("superuser")}
          icon={ShieldCheck}
          label="Superbrukere"
          count={superuserCount}
        />
        <div className="ml-auto relative w-full sm:w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ab-fg-3 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Søk på navn eller e-post…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ab-input h-9 w-full text-[13px] rounded-md bg-ab-subtle border-ab-line hover:border-ab-line-2 focus:border-ab-accent transition-colors"
            style={{ paddingLeft: 32, paddingRight: search ? 30 : 12 }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Nullstill søk"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center text-ab-fg-3 hover:text-ab-fg rounded-md"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* User list */}
      <div className="mt-4 bg-ab-elevated border border-ab-line rounded-xl overflow-hidden">
        {/* Table header */}
        <div
          className="grid items-center gap-4 px-4 h-9 bg-ab-subtle/60 border-b border-ab-line-1"
          style={{ gridTemplateColumns: "minmax(220px,1.4fr) 140px minmax(160px,1fr) minmax(180px,1fr) 132px" }}
        >
          <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">Bruker</span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">Rolle</span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">Kontakt</span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-ab-fg-3 font-semibold">Identifikator</span>
          <span />
        </div>

        {loading ? (
          <div className="text-ab-fg-3 text-center py-12 text-[13px]">Laster brukere…</div>
        ) : error ? (
          <div className="bg-ab-danger/10 border-y border-ab-danger/20 text-ab-danger px-4 py-3 text-center text-[13px]">{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <UserX className="h-14 w-14 text-ab-fg-3 mb-3" strokeWidth={1.25} />
            <div className="text-[15px] font-medium text-ab-fg">Ingen brukere funnet</div>
            <p className="mt-1 text-[13px] text-ab-fg-2">Prøv et annet søk eller endre filtre</p>
            <button
              type="button"
              onClick={() => { setSearch(""); setFilter("all"); }}
              className="ab-btn ghost mt-4"
            >
              Tilbakestill filtre
            </button>
          </div>
        ) : (
          filteredUsers.map((user, idx) => (
            <UserRow
              key={user.id}
              user={user}
              isLast={idx === filteredUsers.length - 1}
              onEdit={() => handleEdit(user)}
              onPromote={() => {
                if (user.type === "employee") handlePromoteEmployee(user);
                else if (user.type === "manager") handlePromoteManager(user);
                else if (user.type === "superuser") handleDemoteSuperuser(user);
              }}
              onDelete={() => handleDelete(user)}
            />
          ))
        )}
      </div>
        {/* Modal for Create Manager */}
        {showCreateManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
              <button onClick={handleCreateManagerClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center">Register New Manager</h2>
              <form className="flex flex-col gap-4" onSubmit={handleCreateManagerSubmit}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Username</label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    name="username"
                    value={form.username}
                    onChange={handleFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${formFieldErrors.username ? 'border-red-500 animate-shake' : ''}`}
                    autoComplete="off"
                    required
                  />
                  {formFieldErrors.username && <div className="text-xs text-red-500 animate-fade-in mt-1">{formFieldErrors.username}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${formFieldErrors.email ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {formFieldErrors.email && <div className="text-xs text-red-500 animate-fade-in mt-1">{formFieldErrors.email}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${formFieldErrors.first_name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {formFieldErrors.first_name && <div className="text-xs text-red-500 animate-fade-in mt-1">{formFieldErrors.first_name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${formFieldErrors.last_name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {formFieldErrors.last_name && <div className="text-xs text-red-500 animate-fade-in mt-1">{formFieldErrors.last_name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${formFieldErrors.password ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Must be at least 8 characters, include 1 uppercase, 1 number, 1 special character.
                  </div>
                  {!passwordValid && form.password && (
                    <div className="text-xs text-red-500">Password does not meet requirements.</div>
                  )}
                  {formFieldErrors.password && <div className="text-xs text-red-500 animate-fade-in mt-1">{formFieldErrors.password}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                  <input
                    type="password"
                    name="password_confirm"
                    value={form.password_confirm}
                    onChange={handleFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${formFieldErrors.password_confirm ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {form.password && form.password_confirm && form.password !== form.password_confirm && (
                    <div className="text-xs text-red-500">Passwords do not match.</div>
                  )}
                  {formFieldErrors.password_confirm && <div className="text-xs text-red-500 animate-fade-in mt-1">{formFieldErrors.password_confirm}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">AB Person ID (Optional)</label>
                  <input
                    type="text"
                    name="ab_person_id"
                    value={form.ab_person_id}
                    onChange={handleFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base font-mono ${formFieldErrors.ab_person_id ? 'border-red-500 animate-shake' : ''}`}
                    maxLength={4}
                    placeholder="1234"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    4-digit ID (optional, leave empty if not needed)
                  </div>
                  {formFieldErrors.ab_person_id && <div className="text-xs text-red-500 animate-fade-in mt-1">{formFieldErrors.ab_person_id}</div>}
                </div>
                {formError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{formError}</div>}
                {formSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{formSuccess}</div>}
                <button
                  type="submit"
                  className="bg-blue-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-60"
                  disabled={formLoading}
                >
                  {formLoading ? "Creating and sending email..." : "Register Manager"}
                </button>
              </form>
            </div>
          </div>
        )}
        {showCreateEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
              <button onClick={handleCreateEmployeeClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center">Register New Employee</h2>
              <form className="flex flex-col gap-4" onSubmit={handleCreateEmployeeSubmit}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Username</label>
                  <input
                    ref={empFirstInputRef}
                    type="text"
                    name="username"
                    value={empForm.username}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${empFormFieldErrors.username ? 'border-red-500 animate-shake' : ''}`}
                    autoComplete="off"
                    required
                  />
                  {empFormFieldErrors.username && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.username}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={empForm.email}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${empFormFieldErrors.email ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {empFormFieldErrors.email && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.email}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={empForm.first_name}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${empFormFieldErrors.first_name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {empFormFieldErrors.first_name && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.first_name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={empForm.last_name}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${empFormFieldErrors.last_name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {empFormFieldErrors.last_name && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.last_name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={empForm.password}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${empFormFieldErrors.password ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Must be at least 8 characters, include 1 uppercase, 1 number, 1 special character.
                  </div>
                  {!empPasswordValid && empForm.password && (
                    <div className="text-xs text-red-500">Password does not meet requirements.</div>
                  )}
                  {empFormFieldErrors.password && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.password}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                  <input
                    type="password"
                    name="password_confirm"
                    value={empForm.password_confirm}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${empFormFieldErrors.password_confirm ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {empForm.password && empForm.password_confirm && empForm.password !== empForm.password_confirm && (
                    <div className="text-xs text-red-500">Passwords do not match.</div>
                  )}
                  {empFormFieldErrors.password_confirm && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.password_confirm}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">AB Person ID (Optional)</label>
                  <input
                    type="text"
                    name="ab_person_id"
                    value={empForm.ab_person_id}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base font-mono ${empFormFieldErrors.ab_person_id ? 'border-red-500 animate-shake' : ''}`}
                    maxLength={4}
                    placeholder="1234"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    4-digit ID (optional, leave empty if not needed)
                  </div>
                  {empFormFieldErrors.ab_person_id && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.ab_person_id}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Ansatttype</label>
                  <select
                    name="employee_type"
                    value={empForm.employee_type}
                    onChange={handleEmpFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${empFormFieldErrors.employee_type ? 'border-red-500 animate-shake' : ''}`}
                  >
                    <option value="maps_emp">AB Maps Ansatt</option>
                    <option value="qc_emp">Kvalitetskontroll Ansatt</option>
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    Velg typen ansatt som skal opprettes
                  </div>
                  {empFormFieldErrors.employee_type && <div className="text-xs text-red-500 animate-fade-in mt-1">{empFormFieldErrors.employee_type}</div>}
                </div>
                {empFormError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{empFormError}</div>}
                {empFormSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{empFormSuccess}</div>}
                <button
                  type="submit"
                  className="bg-green-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-green-700 transition-all disabled:opacity-60"
                  disabled={empFormLoading}
                >
                  {empFormLoading ? "Creating and sending email..." : "Register Employee"}
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Edit Manager Modal */}
        {showEditManager && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
              <button onClick={handleEditClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center">Edit Manager</h2>
              <form className="flex flex-col gap-4" onSubmit={handleEditSubmit}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.name && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.email ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.email && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.email}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.phone ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.phone && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.phone}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">AB Person ID (Optional)</label>
                  <input
                    type="text"
                    name="ab_person_id"
                    value={editForm.ab_person_id}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base font-mono ${editFormFieldErrors.ab_person_id ? 'border-red-500 animate-shake' : ''}`}
                    maxLength={4}
                    placeholder="1234"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {editingUser?.ab_person_id 
                      ? `Current: ${editingUser.ab_person_id} • Update or clear to remove`
                      : '4-digit ID (optional, leave empty if not needed)'
                    }
                  </div>
                  {editFormFieldErrors.ab_person_id && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.ab_person_id}</div>}
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      name="is_sales_chief"
                      checked={editForm.is_sales_chief}
                      onChange={handleEditFormChange}
                      className="rounded border-gray-300 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    Salgssjef
                  </label>
                  <p className="text-xs text-gray-500 pl-6">
                    Gjelder den tilknyttede innloggingen når den finnes; ellers kan serveren godta verdien, men den har ingen effekt før en konto er koblet til.
                  </p>
                </div>
                {editFormError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{editFormError}</div>}
                {editFormSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{editFormSuccess}</div>}
                <button
                  type="submit"
                  className="bg-blue-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-60"
                  disabled={editFormLoading}
                >
                  {editFormLoading ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Edit Employee Modal */}
        {showEditEmployee && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
              <button onClick={handleEditClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center">Edit Employee</h2>
              <form className="flex flex-col gap-4" onSubmit={handleEditSubmit}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.name && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.email ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.email && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.email}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.phone ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.phone && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.phone}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">AB Person ID (Optional)</label>
                  <input
                    type="text"
                    name="ab_person_id"
                    value={editForm.ab_person_id}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base font-mono ${editFormFieldErrors.ab_person_id ? 'border-red-500 animate-shake' : ''}`}
                    maxLength={4}
                    placeholder="1234"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {editingUser?.ab_person_id 
                      ? `Current: ${editingUser.ab_person_id} • Update or clear to remove`
                      : '4-digit ID (optional, leave empty if not needed)'
                    }
                  </div>
                  {editFormFieldErrors.ab_person_id && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.ab_person_id}</div>}
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      name="is_sales_chief"
                      checked={editForm.is_sales_chief}
                      onChange={handleEditFormChange}
                      className="rounded border-gray-300 h-4 w-4 text-green-600 focus:ring-green-500"
                    />
                    Salgssjef
                  </label>
                  <p className="text-xs text-gray-500 pl-6">
                    Gjelder den tilknyttede innloggingen når den finnes; ellers kan serveren godta verdien, men den har ingen effekt før en konto er koblet til.
                  </p>
                </div>
                {editFormError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{editFormError}</div>}
                {editFormSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{editFormSuccess}</div>}
                <button
                  type="submit"
                  className="bg-green-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-green-700 transition-all disabled:opacity-60"
                  disabled={editFormLoading}
                >
                  {editFormLoading ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Edit Superuser Modal */}
        {showEditSuperuser && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
              <button onClick={handleEditClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center">Rediger superbruker</h2>
              <form className="flex flex-col gap-4" onSubmit={handleEditSubmit}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Fullt navn</label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.name && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${editFormFieldErrors.email ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {editFormFieldErrors.email && <div className="text-xs text-red-500 animate-fade-in mt-1">{editFormFieldErrors.email}</div>}
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      name="is_sales_chief"
                      checked={editForm.is_sales_chief}
                      onChange={handleEditFormChange}
                      className="rounded border-gray-300 h-4 w-4 text-purple-600 focus:ring-purple-500"
                    />
                    Salgssjef
                  </label>
                  <p className="text-xs text-gray-500 pl-6">
                    Lagres på brukerkontoen (brukes i QC-verktøy ved varsling til salgssjefer).
                  </p>
                </div>
                {editFormError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{editFormError}</div>}
                {editFormSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{editFormSuccess}</div>}
                <button
                  type="submit"
                  className="bg-purple-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-purple-700 transition-all disabled:opacity-60"
                  disabled={editFormLoading}
                >
                  {editFormLoading ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fade-in">
              <button onClick={handleDeleteClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900">Delete {deletingUser.type === "manager" ? "Manager" : "Employee"}</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <span className="font-semibold text-gray-900">{deletingUser.name}</span>? 
                  This action cannot be undone.
                </p>
                {deletingUser.type === "manager" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-sm font-medium">Warning</span>
                    </div>
                    <p className="text-yellow-700 text-sm mt-1">
                      If this manager has assigned employees, they will become unassigned after deletion.
                    </p>
                  </div>
                )}
                {deleteError && (
                  <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center mb-4">
                    {deleteError}
                  </div>
                )}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleDeleteClose}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium disabled:opacity-60"
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal for Create Superuser */}
        {showCreateSuperuser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
              <button onClick={handleCreateSuperuserClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              <h2 className="text-2xl font-bold mb-4 text-center">Create New Superuser</h2>
              <form className="flex flex-col gap-4" onSubmit={handleCreateSuperuserSubmit}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Username</label>
                  <input
                    ref={superuserFirstInputRef}
                    type="text"
                    name="username"
                    value={superuserForm.username}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${superuserFormFieldErrors.username ? 'border-red-500 animate-shake' : ''}`}
                    autoComplete="off"
                    required
                  />
                  {superuserFormFieldErrors.username && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.username}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={superuserForm.email}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${superuserFormFieldErrors.email ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {superuserFormFieldErrors.email && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.email}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={superuserForm.first_name}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${superuserFormFieldErrors.first_name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {superuserFormFieldErrors.first_name && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.first_name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={superuserForm.last_name}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${superuserFormFieldErrors.last_name ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {superuserFormFieldErrors.last_name && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.last_name}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={superuserForm.password}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${superuserFormFieldErrors.password ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Must be at least 8 characters, include 1 uppercase, 1 number, 1 special character.
                  </div>
                  {!superuserPasswordValid && superuserForm.password && (
                    <div className="text-xs text-red-500">Password does not meet requirements.</div>
                  )}
                  {superuserFormFieldErrors.password && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.password}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                  <input
                    type="password"
                    name="password_confirm"
                    value={superuserForm.password_confirm}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${superuserFormFieldErrors.password_confirm ? 'border-red-500 animate-shake' : ''}`}
                    required
                  />
                  {superuserForm.password && superuserForm.password_confirm && superuserForm.password !== superuserForm.password_confirm && (
                    <div className="text-xs text-red-500">Passwords do not match.</div>
                  )}
                  {superuserFormFieldErrors.password_confirm && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.password_confirm}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">AB Person ID (Optional)</label>
                  <input
                    type="text"
                    name="ab_person_id"
                    value={superuserForm.ab_person_id}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base font-mono ${superuserFormFieldErrors.ab_person_id ? 'border-red-500 animate-shake' : ''}`}
                    maxLength={4}
                    placeholder="1234"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    4-digit ID (optional, leave empty if not needed)
                  </div>
                  {superuserFormFieldErrors.ab_person_id && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.ab_person_id}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Admin Type</label>
                  <select
                    name="admin_type"
                    value={superuserForm.admin_type}
                    onChange={handleSuperuserFormChange}
                    className={`w-full rounded-lg border px-3 py-3 text-base ${superuserFormFieldErrors.admin_type ? 'border-red-500 animate-shake' : ''}`}
                  >
                    <option value="maps_admin">AB Maps Admin</option>
                    <option value="qc_admin">Kvalitetskontroll Admin</option>
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    Velg typen admin som skal opprettes
                  </div>
                  {superuserFormFieldErrors.admin_type && <div className="text-xs text-red-500 animate-fade-in mt-1">{superuserFormFieldErrors.admin_type}</div>}
                </div>
                {superuserFormError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{superuserFormError}</div>}
                {superuserFormSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{superuserFormSuccess}</div>}
                <button
                  type="submit"
                  className="bg-purple-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-purple-700 transition-all disabled:opacity-60"
                  disabled={superuserFormLoading}
                >
                  {superuserFormLoading ? "Creating and sending email..." : "Create Superuser"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Profile Modal */}
         {showProfile && adminData && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
             <div className="bg-ab-canvas text-ab-fg border border-ab-line rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
               <button onClick={handleProfileClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
               <h2 className="text-2xl font-bold mb-6 text-center">Admin Profile</h2>
               <div className="flex flex-col items-center gap-6">
                 {/* Avatar */}
                 <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                   {getInitials(adminData.name)}
                 </div>
                 
                 {/* User Info */}
                 <div className="text-center space-y-2">
                   <h3 className="text-2xl font-bold text-gray-900">{adminData.name}</h3>
                   <div className="flex items-center justify-center gap-2">
                     <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                       Super Admin
                     </span>
                   </div>
                 </div>
                 
                 {/* Details */}
                 <div className="w-full space-y-3">
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                     <span className="text-gray-600 font-medium">Email</span>
                     <span className="text-gray-900">{adminData.email}</span>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                     <span className="text-gray-600 font-medium">User ID</span>
                     <span className="text-gray-900 font-mono text-sm">{adminData.id}</span>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                     <span className="text-gray-600 font-medium">Role</span>
                     <span className="text-gray-900">Administrator</span>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                     <span className="text-gray-600 font-medium">Permissions</span>
                     <span className="text-gray-900">Full Access</span>
                   </div>
                 </div>
                 
                 {/* Action Buttons */}
                 <div className="w-full space-y-3">
                   <button
                     onClick={handleProfileClose}
                     className="w-full bg-gray-100 text-gray-700 rounded-lg py-3 font-semibold hover:bg-gray-200 transition-all"
                   >
                     Close
                   </button>
                   <button
                     onClick={handleLogout}
                     className="w-full bg-red-600 text-white rounded-lg py-3 font-semibold shadow-lg hover:bg-red-700 transition-all"
                   >
                     Logout
                   </button>
                 </div>
               </div>
             </div>
           </div>
         )}
        {/* Promotion Confirmation Modal */}
        {selectedUserForPromotion && (
          <PromotionConfirmationModal
            isOpen={showPromotionModal}
            onClose={handlePromotionClose}
            user={{
              id: selectedUserForPromotion.id,
              name: selectedUserForPromotion.name,
              email: selectedUserForPromotion.email,
              phone: selectedUserForPromotion.phone,
              type: selectedUserForPromotion.type,
            }}
            promotionType={promotionType}
            isLoading={promotionLoading}
            error={promotionError}
            onConfirm={handlePromotionConfirm}
          />
        )}
        {/* Success message toast */}
        {promotionSuccess && (
          <div className="fixed top-4 right-4 z-50 bg-green-50 border-l-4 border-green-500 text-green-800 px-6 py-4 rounded-lg shadow-xl animate-fade-in max-w-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-1">Success!</h3>
                <p className="text-sm text-green-800">{promotionSuccess}</p>
              </div>
              <button
                onClick={() => setPromotionSuccess(null)}
                className="flex-shrink-0 text-green-600 hover:text-green-800 transition-colors"
                aria-label="Close notification"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeInUp 0.7s;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </DashboardShell>
  );
};

export default AdminMainDashboard;

// ─────────────────────────────────────────────────────────────────────────────
// Redesign sub-components — kept here to minimise file shuffling.
// All existing modals + handlers (above) are byte-identical; these only
// rewrap the page header, top actions, filter strip, and user list.
// ─────────────────────────────────────────────────────────────────────────────

function DashboardShell({
  adminName,
  showDropdown,
  setShowDropdown,
  onProfile,
  onLogout,
  onCreateManager,
  onCreateEmployee,
  onCreateSuperuser,
  onLearning,
  totalCount,
  children,
}: {
  adminName: string;
  showDropdown: boolean;
  setShowDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  onProfile: () => void;
  onLogout: () => void;
  onCreateManager: () => void;
  onCreateEmployee: () => void;
  onCreateSuperuser: () => void;
  onLearning: () => void;
  totalCount: number;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const avatarBg = stringToHsl(adminName, { dark: isDark });

  // Time-based Norwegian greeting + first-name extraction for warmth
  const firstName = (adminName || "")
    .trim()
    .split(/\s+/)[0]
    .replace(/^./, (c) => c.toUpperCase());
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "God natt";
    if (h < 11) return "God morgen";
    if (h < 17) return "God dag";
    if (h < 22) return "God kveld";
    return "God natt";
  })();

  return (
    <div className="relative flex flex-col min-h-screen bg-ab-base bg-page-glow">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
        }}
      />
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
        <PageHeader
          eyebrow={
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-semibold uppercase tracking-[0.12em]">
                <ShieldCheck className="h-3 w-3" />
                ADMIN-MODUS
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                · BRUKERADMINISTRASJON · BRUKERE
              </span>
            </span>
          }
          title={
            <span className="inline-flex items-baseline gap-2 flex-wrap">
              <span>{greeting},</span>
              <span className="text-ab-accent">{firstName}</span>
              <span className="text-ab-fg-3 font-normal">👋</span>
            </span>
          }
          description={
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              Du administrerer{" "}
              <span className="font-medium text-ab-fg tabular mono">{totalCount}</span>{" "}
              brukere på AB Marketing-plattformen.
              <span className="text-ab-fg-3">Velg en handling under for å komme i gang.</span>
            </span>
          }
          action={
            <div className="flex items-center gap-2">
              {/* Theme toggle — light/dark switch */}
              <ThemeToggle className="h-9 w-9 rounded-lg" />

              {/* Læringsplattform — ghost link with external glyph */}
              <button
                type="button"
                onClick={onLearning}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-ab-fg-2 hover:text-ab-fg hover:bg-ab-hover text-[13px] font-medium transition-all duration-120"
              >
                <BookOpen className="h-4 w-4" />
                Læringsplattform
                <ArrowUpRight className="h-3.5 w-3.5 -translate-y-px text-ab-fg-3" />
              </button>

              {/* Primary split-button: solid accent + role dropdown */}
              <div className="inline-flex items-stretch rounded-lg shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={onCreateManager}
                  className="inline-flex items-center gap-2 h-9 pl-3.5 pr-3 bg-ab-accent text-ab-on-accent text-[13px] font-semibold hover:bg-ab-accent/90 active:scale-[0.99] transition-all duration-120 border-r border-ab-on-accent/15"
                >
                  <UserPlus className="h-4 w-4" />
                  Ny bruker
                  <kbd className="ml-1 inline-flex items-center justify-center h-5 px-1.5 rounded border border-ab-on-accent/30 bg-ab-on-accent/10 text-[10px] font-mono leading-none">
                    ⌘N
                  </kbd>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Velg brukerrolle"
                      className="inline-flex items-center justify-center h-9 w-9 bg-ab-accent text-ab-on-accent hover:bg-ab-accent/90 active:scale-[0.99] transition-all duration-120"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[260px]">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold px-2 py-1.5">
                      VELG BRUKERROLLE
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={onCreateManager}
                      className="cursor-pointer py-2.5"
                    >
                      <span className="h-8 w-8 rounded-md bg-ab-accent/10 text-ab-accent inline-flex items-center justify-center mr-3 shrink-0">
                        <UserCog className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[13px] font-medium text-ab-fg">
                          Ny leder
                        </span>
                        <span className="text-[11px] text-ab-fg-3">
                          Kan administrere ansatte og områder
                        </span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={onCreateEmployee}
                      className="cursor-pointer py-2.5"
                    >
                      <span className="h-8 w-8 rounded-md bg-ab-success/10 text-ab-success inline-flex items-center justify-center mr-3 shrink-0">
                        <UserIcon className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[13px] font-medium text-ab-fg">
                          Ny ansatt
                        </span>
                        <span className="text-[11px] text-ab-fg-3">
                          Feltarbeider som registrerer salg
                        </span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={onCreateSuperuser}
                      className="cursor-pointer py-2.5"
                    >
                      <span className="h-8 w-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 inline-flex items-center justify-center mr-3 shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[13px] font-medium text-ab-fg">
                          Ny superbruker
                        </span>
                        <span className="text-[11px] text-ab-fg-3">
                          Full tilgang til plattformen
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          }
        />

        <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto w-full pb-12">
          {/* Innlogget som strip with dropdown */}
          <div className="relative admin-avatar-dropdown text-[12px] text-ab-fg-2 flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => setShowDropdown((v) => !v)}
              className="flex items-center gap-2 hover:text-ab-fg transition-colors"
            >
              <span
                aria-hidden
                className="h-[18px] w-[18px] rounded-full inline-flex items-center justify-center text-[9px] font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10"
                style={{
                  background: avatarBg,
                  color: isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.72)",
                }}
              >
                {initialsOf(adminName)}
              </span>
              <span>
                Innlogget som <span className="text-ab-fg font-medium">{adminName}</span> · Admin
              </span>
            </button>
            {showDropdown && (
              <div className="absolute left-0 top-7 z-50 w-56 bg-ab-elevated border border-ab-line rounded-lg shadow-xl py-1.5">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-ab-hover text-[13px] text-ab-fg flex items-center gap-2 transition-colors"
                  onClick={onProfile}
                >
                  <UserCircle className="h-4 w-4 text-ab-fg-3" />
                  Profile
                </button>
                <div className="border-t border-ab-line-1 my-1" />
                <button
                  className="w-full text-left px-3 py-2 hover:bg-ab-danger/10 text-[13px] text-ab-danger flex items-center gap-2 transition-colors"
                  onClick={onLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logg ut
                </button>
              </div>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function TopActionButton({
  onClick,
  icon: Icon,
  label,
  tint,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tint: "accent" | "success" | "purple";
}) {
  const tintClasses: Record<typeof tint, string> = {
    accent:
      "border-ab-accent/20 bg-ab-accent/[0.08] text-ab-accent hover:bg-ab-accent/[0.12] hover:border-ab-accent/30",
    success:
      "border-ab-success/25 bg-ab-success/[0.08] text-ab-success hover:bg-ab-success/[0.12] hover:border-ab-success/35",
    purple:
      "border-purple-500/25 bg-purple-500/[0.08] text-purple-700 dark:text-purple-300 hover:bg-purple-500/[0.12] hover:border-purple-500/35",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-4 rounded-lg border text-[13px] font-medium transition-all duration-120 active:scale-[0.98]",
        tintClasses[tint],
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function KpiCard({
  active,
  onClick,
  icon: Icon,
  label,
  value,
  tint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tint: "neutral" | "accent" | "success" | "purple";
}) {
  const tintMap: Record<typeof tint, { iconBox: string; glow: string; ring: string }> = {
    neutral: {
      iconBox: "bg-ab-subtle text-ab-fg-2",
      glow: "bg-ab-fg-3/10",
      ring: "ring-ab-line",
    },
    accent: {
      iconBox: "bg-ab-accent/10 text-ab-accent",
      glow: "bg-ab-accent/15",
      ring: "ring-ab-accent/30",
    },
    success: {
      iconBox: "bg-ab-success/10 text-ab-success",
      glow: "bg-ab-success/15",
      ring: "ring-ab-success/30",
    },
    purple: {
      iconBox:
        "bg-purple-500/10 text-purple-600 dark:text-purple-300",
      glow: "bg-purple-500/15",
      ring: "ring-purple-500/30",
    },
  };
  const t = tintMap[tint];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden text-left bg-ab-elevated border border-ab-line rounded-xl p-5 transition-all duration-200",
        "hover:border-ab-line-2 hover:shadow-sm",
        active && cn("ring-2", t.ring, "border-transparent"),
      )}
    >
      {/* Decorative tinted glow top-right */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl opacity-60",
          t.glow,
        )}
      />
      <div className="relative flex items-start justify-between">
        <span
          aria-hidden
          className={cn(
            "h-8 w-8 rounded-lg inline-flex items-center justify-center",
            t.iconBox,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-ab-fg-3 opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="relative mt-4">
        <div className="text-[10px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
          {label}
        </div>
        <div className="mt-1 text-[28px] font-semibold tabular text-ab-fg leading-none">
          {value}
        </div>
      </div>
    </button>
  );
}

function FilterTab({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-[13px] transition-colors duration-120",
        active
          ? "bg-ab-subtle text-ab-fg font-medium"
          : "text-ab-fg-2 hover:text-ab-fg hover:bg-ab-subtle/60",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className="text-[11px] tabular text-ab-fg-3 font-normal">({count})</span>
    </button>
  );
}

function UserRow({
  user,
  isLast,
  onEdit,
  onPromote,
  onDelete,
}: {
  user: UserCard;
  isLast: boolean;
  onEdit: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const bg = stringToHsl(user.name, { dark: isDark });
  const initials = initialsOf(user.name);

  const roleConfig =
    user.type === "manager"
      ? {
          label: "LEDER",
          cls: "border-ab-accent/20 bg-ab-accent/10 text-ab-accent",
          stripe: "bg-ab-accent/60",
        }
      : user.type === "employee"
      ? {
          label: "ANSATT",
          cls: "border-ab-success/25 bg-ab-success/10 text-ab-success",
          stripe: "bg-ab-success/60",
        }
      : {
          label: "SUPERBRUKER",
          cls: "border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-300",
          stripe: "bg-purple-500/60",
        };

  const promoteConfig =
    user.type === "employee"
      ? { icon: ChevronUp, title: "Forfremm til leder" }
      : user.type === "manager"
      ? { icon: Star, title: "Forfremm til superbruker" }
      : { icon: ChevronDown, title: "Degrader til leder" };

  const idShort =
    user.id.length > 14
      ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}`
      : user.id;

  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(user.id);
      toast({ title: "ID kopiert" });
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        "group relative grid items-center gap-4 px-5 min-h-[72px] transition-colors duration-120 hover:bg-ab-subtle/60",
        !isLast && "border-b border-ab-line-1",
      )}
      style={{ gridTemplateColumns: "minmax(220px,1.4fr) 140px minmax(160px,1fr) minmax(180px,1fr) 132px" }}
    >
      {/* Role-color stripe — admin-page signal */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-3 bottom-3 w-[2px] rounded-full",
          roleConfig.stripe,
        )}
      />

      {/* BRUKER */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="h-10 w-10 rounded-full inline-flex items-center justify-center text-[13px] font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10 shrink-0 transition-all duration-150 group-hover:ring-ab-accent/20"
          style={{
            background: bg,
            color: isDark ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.72)",
          }}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ab-fg truncate">{user.name}</div>
          <div className="text-[13px] text-ab-fg-2 truncate">{user.email}</div>
        </div>
      </div>

      {/* ROLLE */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center h-7 px-2.5 rounded-md text-[12px] font-medium uppercase tracking-wider border",
            roleConfig.cls,
          )}
        >
          {roleConfig.label}
        </span>
        {user.is_sales_chief && (
          <span className="inline-flex items-center h-6 px-1.5 rounded-md text-[11px] font-medium border border-ab-warning/25 bg-ab-warning/10 text-ab-warning">
            Salgssjef
          </span>
        )}
      </div>

      {/* KONTAKT */}
      <div className="min-w-0">
        {user.phone && user.phone !== "No phone" ? (
          <div className="flex items-center gap-1.5 text-[13px] text-ab-fg tabular mono">
            <Phone className="h-3.5 w-3.5 text-ab-fg-3 shrink-0" />
            <span className="truncate">{user.phone}</span>
          </div>
        ) : (
          <span className="text-ab-fg-3 opacity-60">—</span>
        )}
        {user.type === "employee" && (
          <div className="text-[12px] text-ab-fg-3 mt-0.5 truncate">
            Leder: <span className="text-ab-fg-2">{user.manager_id || "—"}</span>
          </div>
        )}
      </div>

      {/* IDENTIFIKATOR */}
      <div className="min-w-0">
        {user.ab_person_id ? (
          <span className="inline-flex items-center gap-1.5 bg-ab-subtle border border-ab-line-1 rounded-md h-7 px-2.5 text-[12px] font-mono tabular text-ab-fg">
            <IdCard className="h-3.5 w-3.5 text-ab-fg-3" />
            {user.ab_person_id}
          </span>
        ) : (
          <span className="text-[12px] text-ab-fg-3 opacity-60">Ingen ID</span>
        )}
        <button
          type="button"
          onClick={copyId}
          title={`Kopier ${user.id}`}
          className="block mt-1 text-[11px] font-mono text-ab-fg-3 tabular truncate hover:text-ab-fg transition-colors"
        >
          <span className="inline-flex items-center gap-1">
            ID: {idShort}
            <Copy className="h-2.5 w-2.5 opacity-60" />
          </span>
        </button>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Rediger"
          title="Rediger"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
        >
          <Pencil className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={onPromote}
          aria-label={promoteConfig.title}
          title={promoteConfig.title}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
        >
          <promoteConfig.icon className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Slett"
          title="Slett"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-ab-fg-3 hover:text-ab-danger hover:bg-ab-danger/10 transition-colors"
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
} 