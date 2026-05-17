import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { areaService } from '../services/areaService';
import './AssignEmployeesModal.css';

const AssignEmployeesModal = ({ isOpen, onClose, areaId, areaName }) => {
  // PHASE 1: Multi-view state management
  const [currentView, setCurrentView] = useState('main'); // 'main', 'add', 'remove'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [viewHistory, setViewHistory] = useState(['main']);
  
  // PHASE 5: Transition direction state
  const [transitionDirection, setTransitionDirection] = useState('forward'); // 'forward' or 'back'
  
  // Existing data state
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // PHASE 7: Toast notification state
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success' // 'success' or 'error'
  });
  
  // PHASE 1: Unified search state (preserved across views)
  const [searchState, setSearchState] = useState({
    add: '',
    remove: ''
  });
  
  // Legacy search state (for backward compatibility during transition)
  const [availableSearchQuery, setAvailableSearchQuery] = useState('');
  const [assignedSearchQuery, setAssignedSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen || !areaId) return;
    
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const [unassigned, assigned] = await Promise.all([
          areaService.getUnassignedEmployees(areaId),
          areaService.getAreaEmployees(areaId)
        ]);
        
        setAvailableEmployees(Array.isArray(unassigned) ? unassigned : []);
        setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setError(error.message || 'Failed to fetch employees');
        setAvailableEmployees([]);
        setAssignedEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [isOpen, areaId]);

  // PHASE 1: Reset view state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentView('main');
      setViewHistory(['main']);
      setIsTransitioning(false);
      setSearchState({ add: '', remove: '' });
      console.log('[AssignEmployees] Modal opened - state reset to main view');
    }
  }, [isOpen]);

  // PHASE 1: Log view changes for debugging
  useEffect(() => {
    console.log(`[AssignEmployees] Current view: ${currentView}`);
    console.log(`[AssignEmployees] View history:`, viewHistory);
    console.log(`[AssignEmployees] Is transitioning: ${isTransitioning}`);
  }, [currentView, viewHistory, isTransitioning]);

  // ============================================================================
  // PHASE 7: TOAST NOTIFICATION FUNCTIONS
  // ============================================================================
  
  /**
   * PHASE 7: Show toast notification
   * @param {string} message - The message to display
   * @param {string} type - 'success' or 'error'
   */
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 2500);
  };
  
  /**
   * PHASE 7: Retry fetching employees after error
   */
  const handleRetry = async () => {
    if (!areaId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [unassigned, assigned] = await Promise.all([
        areaService.getUnassignedEmployees(areaId),
        areaService.getAreaEmployees(areaId)
      ]);
      
      setAvailableEmployees(Array.isArray(unassigned) ? unassigned : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
      showToast('✓ Ansatte lastet inn!', 'success');
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError(error.message || 'Kunne ikke laste inn ansatte');
      setAvailableEmployees([]);
      setAssignedEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PHASE 1: NAVIGATION FUNCTIONS
  // ============================================================================
  
  /**
   * PHASE 5: Navigate to a specific view with transition
   * @param {string} targetView - The view to navigate to ('main', 'add', 'remove')
   */
  const goToView = (targetView) => {
    if (isTransitioning) {
      console.log('[Navigation] Blocked: Transition in progress');
      return;
    }
    
    console.log(`[Navigation] Moving from ${currentView} to ${targetView}`);
    setTransitionDirection('forward'); // PHASE 5: Set forward transition
    setIsTransitioning(true);
    setCurrentView(targetView);
    setViewHistory(prev => [...prev, targetView]);
    
    // End transition after animation duration (300ms)
    setTimeout(() => {
      setIsTransitioning(false);
      console.log('[Navigation] Transition complete');
    }, 300);
  };
  
  /**
   * PHASE 5: Navigate back to the previous view with back transition
   */
  const goBack = () => {
    if (isTransitioning) {
      console.log('[Navigation] Blocked: Transition in progress');
      return;
    }
    
    if (viewHistory.length <= 1) {
      console.log('[Navigation] Already at root view');
      return;
    }
    
    console.log(`[Navigation] Going back from ${currentView}`);
    setTransitionDirection('back'); // PHASE 5: Set back transition
    setIsTransitioning(true);
    
    setViewHistory(prev => {
      const newHistory = prev.slice(0, -1);
      const previousView = newHistory[newHistory.length - 1] || 'main';
      setCurrentView(previousView);
      console.log(`[Navigation] Returned to ${previousView}`);
      return newHistory;
    });
    
    // End transition after animation duration (300ms)
    setTimeout(() => {
      setIsTransitioning(false);
      console.log('[Navigation] Transition complete');
    }, 300);
  };

  // ============================================================================
  // EXISTING HANDLERS (PRESERVED)
  // ============================================================================

  const handleAssign = async (employee) => {
    // PHASE 7: Optimistic update with toast notification
    try {
      // Optimistic update
      setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
      setAssignedEmployees(prev => [...prev, employee]);
      
      await areaService.addEmployeeToArea(areaId, employee);
      
      // PHASE 7: Show success toast
      showToast(`✓ ${employee.name || employee.full_name} lagt til!`, 'success');
      
      // Refresh data to ensure consistency
      const [unassigned, assigned] = await Promise.all([
        areaService.getUnassignedEmployees(areaId),
        areaService.getAreaEmployees(areaId)
      ]);
      
      setAvailableEmployees(Array.isArray(unassigned) ? unassigned : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
    } catch (error) {
      console.error('Error assigning employee:', error);
      // Revert optimistic update on error
      setAvailableEmployees(prev => [...prev, employee]);
      setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
      // PHASE 7: Show error toast
      showToast('⚠️ Kunne ikke legge til ansatt', 'error');
    }
  };

  const handleUnassign = async (employee) => {
    // PHASE 7: Optimistic update with toast notification
    try {
      // Optimistic update
      setAssignedEmployees(prev => prev.filter(e => e.id !== employee.id));
      setAvailableEmployees(prev => [...prev, employee]);
      
      await areaService.removeEmployeeFromArea(areaId, employee);
      
      // PHASE 7: Show success toast
      showToast(`✓ ${employee.name || employee.full_name} fjernet!`, 'success');
      
      // Refresh data to ensure consistency
      const [unassigned, assigned] = await Promise.all([
        areaService.getUnassignedEmployees(areaId),
        areaService.getAreaEmployees(areaId)
      ]);
      
      setAvailableEmployees(Array.isArray(unassigned) ? unassigned : []);
      setAssignedEmployees(Array.isArray(assigned) ? assigned : []);
    } catch (error) {
      console.error('Error unassigning employee:', error);
      // Revert optimistic update on error
      setAssignedEmployees(prev => [...prev, employee]);
      setAvailableEmployees(prev => prev.filter(e => e.id !== employee.id));
      // PHASE 7: Show error toast
      showToast('⚠️ Kunne ikke fjerne ansatt', 'error');
    }
  };

  // PHASE 3: Filter employees using new searchState
  const filteredAvailableEmployees = availableEmployees.filter(employee =>
    employee.name?.toLowerCase().includes(searchState.add.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchState.add.toLowerCase())
  );

  const filteredAssignedEmployees = assignedEmployees.filter(employee =>
    employee.name?.toLowerCase().includes(searchState.remove.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchState.remove.toLowerCase())
  );
  
  // Legacy filters (for backward compatibility with old view)
  const legacyFilteredAvailableEmployees = availableEmployees.filter(employee =>
    employee.name?.toLowerCase().includes(availableSearchQuery.toLowerCase()) ||
    employee.email?.toLowerCase().includes(availableSearchQuery.toLowerCase())
  );

  const legacyFilteredAssignedEmployees = assignedEmployees.filter(employee =>
    employee.name?.toLowerCase().includes(assignedSearchQuery.toLowerCase()) ||
    employee.email?.toLowerCase().includes(assignedSearchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  // ============================================================================
  // PHASE 2: MAIN VIEW RENDER
  // ============================================================================
  const renderMainView = () => (
    <div className="assign-modal-main-view">
      {/* PHASE 2: Integrated header with close button */}
      <div className="assign-modal-header-integrated">
        <h2>Tildel ansatte til {areaName}</h2>
        <button 
          className="assign-modal-close-btn-integrated" 
          onClick={onClose}
          aria-label="Lukk"
        >
          ×
        </button>
      </div>
      
      {/* PHASE 2: Main content with action buttons */}
      <div className="assign-modal-main-content">
        {/* Add Employee Button */}
        <button 
          className="assign-modal-action-btn assign-modal-add-btn" 
          onClick={() => goToView('add')}
          disabled={isTransitioning}
          aria-label="Legg til ansatt"
        >
          <div className="assign-modal-action-btn-icon assign-modal-add-icon">➕</div>
          <div className="assign-modal-action-btn-text">Legg til ansatt</div>
          <div className="assign-modal-action-btn-arrow">→</div>
        </button>
        
        {/* Remove Employee Button */}
        <button 
          className="assign-modal-action-btn assign-modal-remove-btn" 
          onClick={() => goToView('remove')}
          disabled={isTransitioning}
          aria-label="Fjern ansatt"
        >
          <div className="assign-modal-action-btn-icon assign-modal-remove-icon">➖</div>
          <div className="assign-modal-action-btn-text">Fjern ansatt</div>
          <div className="assign-modal-action-btn-arrow">→</div>
        </button>
        
        {/* Employee Count Indicator */}
        <div className="assign-modal-employee-count-indicator">
          <div className="assign-modal-count-label">Tildelte ansatte:</div>
          <div className="assign-modal-count-value">{assignedEmployees.length}</div>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // PHASE 3: ADD EMPLOYEE VIEW RENDER
  // ============================================================================
  const renderAddView = () => (
    <div className="assign-modal-nested-view assign-modal-add-view">
      {/* PHASE 3: Nested header with back button */}
      <div className="assign-modal-nested-header">
        <button 
          className="assign-modal-back-btn" 
          onClick={goBack}
          disabled={isTransitioning}
          aria-label="Tilbake"
        >
          <span className="assign-modal-back-icon">←</span>
          <span className="assign-modal-back-text">Tilbake</span>
        </button>
        <h2>Legg til ansatt</h2>
        <button 
          className="assign-modal-close-btn-integrated" 
          onClick={onClose}
          aria-label="Lukk"
        >
          ×
        </button>
      </div>
      
      {/* PHASE 3: Search section */}
      <div className="assign-modal-search-section">
        <div className="assign-modal-search-wrapper">
          <span className="assign-modal-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Søk etter navn eller e-post..."
            value={searchState.add}
            onChange={(e) => setSearchState({...searchState, add: e.target.value})}
            className="assign-modal-search-input"
          />
          {searchState.add && (
            <button 
              className="assign-modal-clear-search" 
              onClick={() => setSearchState({...searchState, add: ''})}
              aria-label="Tøm søk"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* PHASE 7: Error banner */}
      {error && (
        <div className="assign-modal-error-banner">
          <div className="assign-modal-error-icon">⚠️</div>
          <div className="assign-modal-error-content">
            <div className="assign-modal-error-title">Noe gikk galt</div>
            <div className="assign-modal-error-message">{error}</div>
          </div>
          <button className="assign-modal-retry-btn" onClick={handleRetry}>
            Prøv igjen
          </button>
        </div>
      )}
      
      {/* PHASE 3: Employees scroll container */}
      <div className="assign-modal-employees-scroll-container">
        {loading ? (
          <div className="assign-modal-loading-state">
            <div className="assign-modal-loading-spinner"></div>
            <div className="assign-modal-loading-text">Laster ansatte...</div>
          </div>
        ) : filteredAvailableEmployees.length === 0 ? (
          <div className="assign-modal-empty-state">
            <div className="assign-modal-empty-icon">👥</div>
            <div className="assign-modal-empty-text">
              {searchState.add ? 'Ingen ansatte funnet' : 'Ingen tilgjengelige ansatte'}
            </div>
            {searchState.add && (
              <button 
                className="assign-modal-clear-search-btn"
                onClick={() => setSearchState({...searchState, add: ''})}
              >
                Tøm søk
              </button>
            )}
          </div>
        ) : (
          filteredAvailableEmployees.map(employee => (
            <div key={employee.id} className="assign-modal-employee-card">
              <div className="assign-modal-employee-details">
                <div className="assign-modal-employee-name">
                  {employee.name || employee.full_name}
                </div>
                <div className="assign-modal-employee-email">
                  {employee.email}
                </div>
                <div className="assign-modal-employee-status">
                  <span className={`assign-modal-status-dot ${employee.status === 'active' ? 'active' : 'offline'}`}></span>
                  Status: {employee.status || 'offline'}
                </div>
              </div>
              <button 
                className="assign-modal-assign-action-btn" 
                onClick={() => handleAssign(employee)}
                aria-label={`Legg til ${employee.name || employee.full_name}`}
              >
                <span className="assign-modal-action-icon">+</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ============================================================================
  // PHASE 4: REMOVE EMPLOYEE VIEW RENDER
  // ============================================================================
  const renderRemoveView = () => (
    <div className="assign-modal-nested-view assign-modal-remove-view">
      {/* PHASE 4: Nested header with back button */}
      <div className="assign-modal-nested-header">
        <button 
          className="assign-modal-back-btn" 
          onClick={goBack}
          disabled={isTransitioning}
          aria-label="Tilbake"
        >
          <span className="assign-modal-back-icon">←</span>
          <span className="assign-modal-back-text">Tilbake</span>
        </button>
        <h2>Fjern ansatt</h2>
        <button 
          className="assign-modal-close-btn-integrated" 
          onClick={onClose}
          aria-label="Lukk"
        >
          ×
        </button>
      </div>
      
      {/* PHASE 4: Search section */}
      <div className="assign-modal-search-section">
        <div className="assign-modal-search-wrapper">
          <span className="assign-modal-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Søk etter navn eller e-post..."
            value={searchState.remove}
            onChange={(e) => setSearchState({...searchState, remove: e.target.value})}
            className="assign-modal-search-input"
          />
          {searchState.remove && (
            <button 
              className="assign-modal-clear-search" 
              onClick={() => setSearchState({...searchState, remove: ''})}
              aria-label="Tøm søk"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* PHASE 7: Error banner */}
      {error && (
        <div className="assign-modal-error-banner">
          <div className="assign-modal-error-icon">⚠️</div>
          <div className="assign-modal-error-content">
            <div className="assign-modal-error-title">Noe gikk galt</div>
            <div className="assign-modal-error-message">{error}</div>
          </div>
          <button className="assign-modal-retry-btn" onClick={handleRetry}>
            Prøv igjen
          </button>
        </div>
      )}
      
      {/* PHASE 4: Employees scroll container */}
      <div className="assign-modal-employees-scroll-container">
        {loading ? (
          <div className="assign-modal-loading-state">
            <div className="assign-modal-loading-spinner"></div>
            <div className="assign-modal-loading-text">Laster ansatte...</div>
          </div>
        ) : filteredAssignedEmployees.length === 0 ? (
          <div className="assign-modal-empty-state">
            <div className="assign-modal-empty-icon">👥</div>
            <div className="assign-modal-empty-text">
              {searchState.remove ? 'Ingen ansatte funnet' : 'Ingen tildelte ansatte'}
            </div>
            {searchState.remove && (
              <button 
                className="assign-modal-clear-search-btn"
                onClick={() => setSearchState({...searchState, remove: ''})}
              >
                Tøm søk
              </button>
            )}
          </div>
        ) : (
          filteredAssignedEmployees.map(employee => (
            <div key={employee.id} className="assign-modal-employee-card">
              <div className="assign-modal-employee-details">
                <div className="assign-modal-employee-name">
                  {employee.name || employee.full_name}
                </div>
                <div className="assign-modal-employee-email">
                  {employee.email}
                </div>
                <div className="assign-modal-employee-status">
                  <span className={`assign-modal-status-dot ${employee.status === 'active' ? 'active' : 'offline'}`}></span>
                  Status: {employee.status || 'offline'}
                </div>
              </div>
              <button 
                className="assign-modal-remove-action-btn" 
                onClick={() => handleUnassign(employee)}
                aria-label={`Fjern ${employee.name || employee.full_name}`}
              >
                <span className="assign-modal-action-icon">−</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ============================================================================
  // TEMPORARY: OLD VIEW (will be removed after Phase 4 complete)
  // ============================================================================
  const renderOldView = () => (
    <>
        <div className="modal-header">
          <h2>Tildel ansatte til {areaName}</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        
        <div className="modal-body">
          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
              <button 
                className="retry-button"
                onClick={() => {
                  setError(null);
                  // Trigger refetch by toggling isOpen
                  setShowAssignEmployeesModal(false);
                  setTimeout(() => setShowAssignEmployeesModal(true), 100);
                }}
              >
                Retry
              </button>
            </div>
          )}
          
          <div className="employees-container">
            {/* Available Employees */}
            <div className="employees-section">
              <h3>Tilgjengelige ansatte</h3>
              
              {/* Search input for available employees */}
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Søk etter navn eller e-post..."
                  value={availableSearchQuery}
                  onChange={(e) => setAvailableSearchQuery(e.target.value)}
                  className="search-input"
                />
                {availableSearchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setAvailableSearchQuery('')}
                    title="Tøm søk"
                  >
                    ×
                  </button>
                )}
              </div>
              
              <div className="employees-list">
                {loading ? (
                  <div className="loading">Laster...</div>
                ) : filteredAvailableEmployees.length === 0 ? (
                  <div className="no-employees">
                    {availableSearchQuery ? 'Ingen ansatte funnet' : 'Ingen tilgjengelige ansatte'}
                  </div>
                ) : (
                  filteredAvailableEmployees.map((employee) => (
                    <div key={employee.id} className="employee-item">
                      <div className="employee-info">
                        <div className="employee-name">{employee.name || employee.full_name}</div>
                        <div className="employee-email">{employee.email}</div>
                        <div className="employee-status">Status: {employee.status || 'Aktiv'}</div>
                      </div>
                      <button
                        className="assign-button"
                        onClick={() => handleAssign(employee)}
                        title="Tildel"
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Assigned Employees */}
            <div className="employees-section">
              <h3>Tildelte ansatte</h3>
              
              {/* Search input for assigned employees */}
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Søk etter navn eller e-post..."
                  value={assignedSearchQuery}
                  onChange={(e) => setAssignedSearchQuery(e.target.value)}
                  className="search-input"
                />
                {assignedSearchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setAssignedSearchQuery('')}
                    title="Tøm søk"
                  >
                    ×
                  </button>
                )}
              </div>
              
              <div className="employees-list">
                {loading ? (
                  <div className="loading">Laster...</div>
                ) : filteredAssignedEmployees.length === 0 ? (
                  <div className="no-employees">
                    {assignedSearchQuery ? 'Ingen ansatte funnet' : 'Ingen tildelte ansatte'}
                  </div>
                ) : (
                  filteredAssignedEmployees.map((employee) => (
                    <div key={employee.id} className="employee-item">
                      <div className="employee-info">
                        <div className="employee-name">{employee.name || employee.full_name}</div>
                        <div className="employee-email">{employee.email}</div>
                        <div className="employee-status">Status: {employee.status || 'Aktiv'}</div>
                      </div>
                      <button
                        className="unassign-button"
                        onClick={() => handleUnassign(employee)}
                        title="Fjern tildeling"
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Lukk
          </button>
          <button className="btn-primary" onClick={onClose}>
            Lagre endringer
          </button>
        </div>
    </>
  );

  // ============================================================================
  // PHASE 4: CONDITIONAL VIEW RENDERING (UPDATED)
  // ============================================================================
  const renderCurrentView = () => {
    switch (currentView) {
      case 'main':
        return renderMainView();
      case 'add':
        return renderAddView(); // PHASE 3: New Add Employee view
      case 'remove':
        return renderRemoveView(); // PHASE 4: New Remove Employee view
      default:
        return renderMainView();
    }
  };

  // ============================================================================
  // PHASE 5: MODAL CONTAINER WITH TRANSITIONS
  // ============================================================================
  const modal = (
    <div className="assign-employees-overlay" role="dialog" aria-modal="true">
      <div className="assign-employees-modal">
        {/* PHASE 5: View container with transition support */}
        <div 
          className={`assign-modal-views-container 
            ${isTransitioning ? 'assign-modal-view-transitioning' : ''} 
            ${transitionDirection === 'forward' ? 'assign-modal-transitioning-forward' : ''} 
            ${transitionDirection === 'back' ? 'assign-modal-transitioning-back' : ''}`}
        >
          {renderCurrentView()}
        </div>
        
        {/* PHASE 7: Toast notification */}
        {toast.show && (
          <div className={`assign-modal-toast assign-modal-toast-${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );

  const root = document.getElementById("modal-root") || document.body;
  return ReactDOM.createPortal(modal, root);
};

export default AssignEmployeesModal;
