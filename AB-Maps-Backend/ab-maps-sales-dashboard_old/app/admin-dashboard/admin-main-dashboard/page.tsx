"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchManagers, fetchEmployees, registerUser, updateManager, updateEmployee, deleteManager, deleteEmployee } from "../adminServices";
import { adminAuthService } from "@/lib/auth/adminAuthService";
import { useRouter } from "next/navigation";

const MANAGER_COLOR = "bg-blue-100 text-blue-700";
const EMPLOYEE_COLOR = "bg-green-100 text-green-700";

interface UserCard {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "manager" | "employee";
  manager_id?: string;
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

// Patch registerUser to handle non-JSON error responses
async function robustRegisterUser(payload: any) {
  try {
    const res = await fetch("https://ab-maps-backend-production.onrender.com/api/users/auth/register/", {
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
  const [filter, setFilter] = useState<"all" | "manager" | "employee">("all");
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
  });
  const [empFormError, setEmpFormError] = useState("");
  const [empFormSuccess, setEmpFormSuccess] = useState("");
  const [empFormLoading, setEmpFormLoading] = useState(false);
  const empFirstInputRef = useRef<HTMLInputElement>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<{ [key: string]: string }>({});
  const [empFormFieldErrors, setEmpFormFieldErrors] = useState<{ [key: string]: string }>({});

  // Edit modal states
  const [showEditManager, setShowEditManager] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
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

  // Employee password validation
  const empPasswordValid =
    /[A-Z]/.test(empForm.password) &&
    /[0-9]/.test(empForm.password) &&
    /[^A-Za-z0-9]/.test(empForm.password) &&
    empForm.password.length >= 8;

  const handleEmpFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmpFormError("");
    setEmpFormSuccess("");
    setEmpFormFieldErrors({ ...empFormFieldErrors, [e.target.name]: "" });
    setEmpForm({ ...empForm, [e.target.name]: e.target.value });
  };

  const handleCreateEmployeeOpen = () => {
    setShowCreateEmployee(true);
    setTimeout(() => empFirstInputRef.current?.focus(), 100);
  };

  const handleCreateEmployeeClose = () => {
    setShowCreateEmployee(false);
    setEmpForm({ username: "", email: "", password: "", password_confirm: "", first_name: "", last_name: "" });
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
      const { ok, data } = await registerUser({ ...empForm, user_type: "employee" });
      if (!ok) {
        let fieldErrors: { [key: string]: string } = {};
        if (data.username) fieldErrors.username = data.username;
        if (data.email) fieldErrors.email = data.email;
        if (data.password) fieldErrors.password = data.password;
        if (Object.keys(fieldErrors).length > 0) {
          setEmpFormFieldErrors(fieldErrors);
        } else {
          setEmpFormError(data.error || data.message || "Registration failed.");
        }
        setEmpFormLoading(false);
        return;
      }
      setEmpFormSuccess("Employee registered successfully!");
      setTimeout(() => handleCreateEmployeeClose(), 1200);
    } catch (err) {
      setEmpFormError("Network error. Please try again.");
    } finally {
      setEmpFormLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [mgrs, emps] = await Promise.all([
          fetchManagers(),
          fetchEmployees(),
        ]);
        const managerCards = mgrs.map((m: any) => ({ 
          ...m, 
          type: "manager" as const,
          phone: m.phone || ""
        }));
        const employeeCards = emps.map((e: any) => ({ 
          ...e, 
          type: "employee" as const,
          phone: e.phone || ""
        }));
        setUsers([...managerCards, ...employeeCards]);
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
    fetchData();
  }, [router]);

  // Check authentication on page load
  useEffect(() => {
    const checkAuth = () => {
      if (!adminAuthService.isAuthenticated()) {
        router.push('/admin-dashboard');
        return;
      }
    };
    
    checkAuth();
  }, [router]);

  // Show loading while checking authentication
  if (!adminAuthService.isAuthenticated()) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 via-white to-blue-50 font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

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

  const filteredUsers = users.filter(u => {
    if (filter !== "all" && u.type !== filter) return false;
    if (search && !(
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    )) return false;
    return true;
  });

  // Placeholder handlers
  const handleEdit = (user: UserCard) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
    });
    setEditFormError("");
    setEditFormSuccess("");
    setEditFormFieldErrors({});
    
    if (user.type === "manager") {
      setShowEditManager(true);
    } else {
      setShowEditEmployee(true);
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

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      let success;
      if (deletingUser.type === "manager") {
        success = await deleteManager(deletingUser.id);
      } else {
        success = await deleteEmployee(deletingUser.id);
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
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreateManagerOpen = () => {
    setShowCreateManager(true);
    setTimeout(() => firstInputRef.current?.focus(), 100);
  };

  const handleCreateManagerClose = () => {
    setShowCreateManager(false);
    setForm({ username: "", email: "", password: "", password_confirm: "", first_name: "", last_name: "" });
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
      const { ok, data } = await registerUser({ ...form, user_type: "manager" });
      if (!ok) {
        let fieldErrors: { [key: string]: string } = {};
        if (data.username) fieldErrors.username = data.username;
        if (data.email) fieldErrors.email = data.email;
        if (data.password) fieldErrors.password = data.password;
        if (Object.keys(fieldErrors).length > 0) {
          setFormFieldErrors(fieldErrors);
        } else {
          setFormError(data.error || data.message || "Registration failed.");
        }
        setFormLoading(false);
        return;
      }
      setFormSuccess("Manager registered successfully!");
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
    setEditingUser(null);
    setEditForm({ name: "", email: "", phone: "" });
    setEditFormError("");
    setEditFormSuccess("");
    setEditFormLoading(false);
    setEditFormFieldErrors({});
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormError("");
    setEditFormSuccess("");
    setEditFormFieldErrors({ ...editFormFieldErrors, [e.target.name]: "" });
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
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
    if (!editForm.phone.trim()) {
      newFieldErrors.phone = "Phone number is required.";
      hasError = true;
    }

    if (hasError) {
      setEditFormFieldErrors(newFieldErrors);
      return;
    }

    setEditFormLoading(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      };

      let result;
      if (editingUser.type === "manager") {
        result = await updateManager(editingUser.id, payload);
      } else {
        result = await updateEmployee(editingUser.id, payload);
      }

      setEditFormSuccess(`${editingUser.type === "manager" ? "Manager" : "Employee"} updated successfully!`);
      
      // Update the user in the local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id 
            ? { ...user, ...payload }
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 via-white to-blue-50 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header with avatar and welcome */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                      <div className="flex items-center gap-4">
              <div className="relative admin-avatar-dropdown">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg select-none cursor-pointer hover:shadow-xl transition-all" onClick={() => setShowDropdown(v => !v)}>
                  {getInitials(adminName)}
                </div>
              {showDropdown && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-50 py-2 animate-fade-in border border-gray-200">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm text-gray-500">Signed in as</p>
                    <p className="text-sm font-medium text-gray-900">{adminName}</p>
                  </div>
                  <button 
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2" 
                    onClick={handleProfile}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>
                  <div className="border-t border-gray-100 mt-1">
                    <button 
                      className="block w-full text-left px-4 py-2 hover:bg-red-50 transition-colors text-red-600 flex items-center gap-2" 
                      onClick={handleLogout}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-1">Welcome <span className="capitalize">{adminName}</span></h1>
              <p className="text-gray-500 text-sm">Admin Dashboard</p>
            </div>
          </div>
          {/* FABs for create actions */}
          <div className="flex gap-3">
            <button onClick={handleCreateManagerOpen} className="relative bg-gradient-to-br from-blue-500 to-blue-700 text-white px-6 py-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300">
              + Create Manager
            </button>
            <button onClick={handleCreateEmployeeOpen} className="relative bg-gradient-to-br from-green-500 to-green-700 text-white px-6 py-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all font-semibold focus:outline-none focus:ring-2 focus:ring-green-300">
              + Create Employee
            </button>
          </div>
        </div>
        {/* Filter and search bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 sticky top-0 z-10 bg-opacity-80">
          <div className="flex gap-2">
            <button onClick={() => setFilter("all")}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-medium text-sm shadow-sm transition-all ${filter === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200 hover:bg-blue-50"}`}>
              <span className="material-icons text-base">group</span> All
            </button>
            <button onClick={() => setFilter("manager")}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-medium text-sm shadow-sm transition-all ${filter === "manager" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200 hover:bg-blue-50"}`}>
              <span className="material-icons text-base">supervisor_account</span> Managers
            </button>
            <button onClick={() => setFilter("employee")}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-medium text-sm shadow-sm transition-all ${filter === "employee" ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200 hover:bg-blue-50"}`}>
              <span className="material-icons text-base">person</span> Employees
            </button>
          </div>
          <div className="relative w-full md:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-10 py-2 rounded-full border border-gray-200 shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all bg-white"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearch("")}
                tabIndex={-1}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* User list */}
        <div className="w-full flex flex-col gap-4 animate-fade-in">
          {loading ? (
            <div className="text-gray-500 text-center py-12">Loading...</div>
          ) : error ? (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4 text-center">{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-gray-400 text-center py-12">No users found.</div>
          ) : (
            filteredUsers.map(user => (
              <div
                key={user.id}
                className={`flex items-center bg-white/80 rounded-2xl shadow-md border border-gray-100 px-6 py-4 hover:shadow-xl transition-all min-h-[56px] backdrop-blur-md group`}
                style={{ animation: "fadeInUp 0.5s" }}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow ${user.type === "manager" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{getInitials(user.name)}</div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${user.type === "manager" ? "text-blue-600" : "text-green-600"}`}>{user.type}</span>
                    <span className="font-bold text-base sm:text-lg">{user.name}</span>
                    <span className="text-gray-700 text-sm">{user.email}</span>
                    <span className="text-gray-600 text-sm">{user.phone || "No phone"}</span>
                    {user.type === "employee" && (
                      <span className="text-gray-500 text-xs">Manager ID: {user.manager_id || "-"}</span>
                    )}
                    <span className="text-gray-300 text-xs">ID: {user.id}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4 opacity-70 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => handleEdit(user)}
                    className="rounded-full p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 shadow-sm transition-all"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm0 0L4 19l5-1 1-5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="rounded-full p-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 shadow-sm transition-all"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Modal for Create Manager */}
        {showCreateManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
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
                {formError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{formError}</div>}
                {formSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{formSuccess}</div>}
                <button
                  type="submit"
                  className="bg-blue-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-60"
                  disabled={formLoading}
                >
                  {formLoading ? "Registering..." : "Register Manager"}
                </button>
              </form>
            </div>
          </div>
        )}
        {showCreateEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
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
                {empFormError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center">{empFormError}</div>}
                {empFormSuccess && <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm text-center">{empFormSuccess}</div>}
                <button
                  type="submit"
                  className="bg-green-600 text-white rounded-lg py-2 font-semibold shadow-lg hover:bg-green-700 transition-all disabled:opacity-60"
                  disabled={empFormLoading}
                >
                  {empFormLoading ? "Registering..." : "Register Employee"}
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Edit Manager Modal */}
        {showEditManager && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
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
            <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
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
                 {/* Profile Modal */}
         {showProfile && adminData && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
             <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-lg min-w-[400px] relative animate-fade-in">
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
      </div>
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
    </div>
  );
};

export default AdminMainDashboard; 