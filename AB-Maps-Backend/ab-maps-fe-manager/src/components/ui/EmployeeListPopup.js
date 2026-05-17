import React, { useState, useEffect } from 'react';
import { areaService } from '../../services/areaService';
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

  // Load employees for the selected area
  useEffect(() => {
    const loadAreaEmployees = async () => {
      if (!area || !area.id) {
        setError('Invalid area or area ID');
        setEmployees([]);
        console.error('No area or area.id provided to EmployeeListPopup:', area);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const apiUrl = `/api/areas/areas/${area.id}/team_employees/`;
        console.log('Fetching employees for area (via teams):', area);
        console.log('API URL:', apiUrl);
        const areaEmployees = await areaService.getAreaTeamEmployees(area.id);
        console.log('API response for area team employees:', areaEmployees); // Debug log
        setEmployees(areaEmployees);
        // Set employees directly
        setEmployees(areaEmployees);
      } catch (error) {
        setError('Error loading area employees');
        setEmployees([]);
        console.error('Error loading area employees:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAreaEmployees();
  }, [area]);

  // Filter employees by search
  const filteredEmployees = employees.filter(emp => {
    const employeeObj = emp.employee || emp;
    const name = employeeObj.name || employeeObj.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Calculate online count
  const onlineCount = employees.filter(emp => {
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
                  onClick={() => onEmployeeSelect && onEmployeeSelect(emp)} 
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