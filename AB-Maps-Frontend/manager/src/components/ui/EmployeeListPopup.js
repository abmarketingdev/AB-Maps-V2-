import React, { useState, useEffect } from 'react';
import EmployeeCard from './EmployeeCard';
import './EmployeeListPopup.css';

const EmployeeListPopup = ({ area, onEmployeeSelect, onClose }) => {
  if (!area) return null;
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // Employee status state
  const [isConnected, setIsConnected] = useState(false);

  // Load employees for the selected area from area prop (no API call needed)
  useEffect(() => {
    if (!area) {
      setError('Invalid area');
      setEmployees([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Use employee data directly from area prop (from my_areas response)
      if (area.employees && Array.isArray(area.employees)) {
        setEmployees(area.employees);
      } else {
        setEmployees([]);
        setError('No employees found for this area');
      }
    } catch (error) {
      console.error('Error processing area employees:', error);
      setError('Error processing area employees');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [area]);

  // Filter employees by search
  const filteredEmployees = employees.filter(emp => {
    // Handle both nested employee structure and direct employee structure
    const employeeObj = emp.employee || emp;
    const name = employeeObj.name || employeeObj.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Calculate online count
  const onlineCount = employees.filter(emp => {
    // Handle both nested employee structure and direct employee structure
    const employeeObj = emp.employee || emp;
    return employeeObj.is_online;
  }).length;

  return (
    <div className="employee-list-modal-overlay dark" onClick={onClose}>
      <div className="employee-list-modal dark" onClick={e => e.stopPropagation()}>
        <div className="employee-list-header dark">
          <h2>Employees in <span className="employee-list-area-name">{area.name}</span></h2>
          <div className="employee-list-stats">
            <span className="online-count">
              {onlineCount} online • {employees.length} total
            </span>
            {isConnected && (
              <span className="connection-status online">🟢 Live</span>
            )}
          </div>
        </div>
        <input
          className="employee-search-input"
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {error && <div className="employee-list-error">{error}</div>}
        <div className="employee-list improved">
          {loading ? (
            <div className="loading-message">Loading employees...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="no-employees-message">No employees found</div>
          ) : (
            filteredEmployees.map(emp => (
              <div key={emp.id} className="employee-card-row view-only">
                <EmployeeCard 
                  employee={emp.employee || emp} 
                  onClick={() => onEmployeeSelect && onEmployeeSelect(emp.employee || emp)} 
                />
              </div>
            ))
          )}
        </div>
        <button className="employee-list-close-btn dark" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default EmployeeListPopup; 