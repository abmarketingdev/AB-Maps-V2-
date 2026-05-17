import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, 
  faTimes, 
  faSearch, 
  faSpinner,
  faBuilding,
  faFilter,
  faCheckCircle,
  faCircle,
  faSyncAlt
} from '@fortawesome/free-solid-svg-icons';
import buildingService from '../../services/buildingService';
import ApartmentListItem from './ApartmentListItem';
import { isNRCCampaign, openNRCUrlForApartment } from '../../utils/nrcUrlHelper';
import { isNeiSubcategory } from '../../constants/neiSubcategory';
import './ApartmentListDrawer.css';

/**
 * ApartmentListDrawer Component (Employee App)
 * 
 * Full work view for managing apartments in a building.
 * Features:
 * - Fetch and display apartments from API
 * - Filter tabs (All / Unvisited / Completed)
 * - Search by apartment number
 * - Status updates with optimistic UI
 * - Skeleton loading states
 */
const ApartmentListDrawer = ({
  isOpen,
  onClose,
  buildingId,
  baseAddress,
  onTileRefresh,    // Callback to refresh map tiles after updates
  initialStats,     // Optional: { totalUnits, visitedUnits } from tile
  onOpenCampaignForm, // Callback to open campaign form when 'Ja' is selected
}) => {
  // State
  const [apartments, setApartments] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'unvisited' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [apartmentActionError, setApartmentActionError] = useState({
    id: null,
    message: '',
  });
  
  // Carrier info state (for Talkmore campaigns)
  const [carrierInfo, setCarrierInfo] = useState({
    is_talkmore_campaign: false,
    enriched_count: 0
  });
  
  // Stats (can be computed from apartments or from initialStats)
  const totalCount = apartments.length;
  const visitedCount = apartments.filter(a => a.is_visited).length;
  const unvisitedCount = totalCount - visitedCount;
  const carrierCount = apartments.filter(a => a.carrier_status === 'telenor_talkmore_available').length;

  /**
   * Fetch apartments from API
   */
  const fetchApartments = useCallback(async (showLoading = true) => {
    if (!buildingId) {
      console.warn('[ApartmentListDrawer] No buildingId provided');
      setError('Ingen bygning valgt');
      return;
    }
    
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      console.log('[ApartmentListDrawer] Fetching apartments for buildingId:', buildingId);
      const data = await buildingService.getApartments(buildingId);
      console.log('[ApartmentListDrawer] API response:', data);
      
      const results = data.results || data || [];
      console.log('[ApartmentListDrawer] Parsed results:', results.length, 'apartments');
      
      // Extract carrier info from API response
      if (data.carrier_info) {
        setCarrierInfo(data.carrier_info);
        console.log('[ApartmentListDrawer] Carrier info:', {
          is_talkmore_campaign: data.carrier_info.is_talkmore_campaign,
          enriched_count: data.carrier_info.enriched_count
        });
      } else {
        // Reset to default if not present
        setCarrierInfo({
          is_talkmore_campaign: false,
          enriched_count: 0
        });
      }
      
      if (results.length === 0) {
        console.warn('[ApartmentListDrawer] No apartments found for buildingId:', buildingId);
        setError('Ingen leiligheter funnet for denne bygningen. Bygningen kan være tom eller ikke opprettet ennå.');
      }
      
      // Sort apartments by number (try numeric first, then alphabetic)
      const sorted = [...results].sort((a, b) => {
        const numA = parseInt(a.apartment_number, 10);
        const numB = parseInt(b.apartment_number, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.apartment_number.localeCompare(b.apartment_number);
      });
      
      // List/detail may expose `nei_subcategory` or `visit_info.nei_subcategory`
      setApartments(
        sorted.map((a) => ({
          ...a,
          nei_subcategory:
            a.nei_subcategory ?? a.visit_info?.nei_subcategory ?? null,
        }))
      );
    } catch (err) {
      console.error('[ApartmentListDrawer] Error fetching apartments:', err);
      setError(`Kunne ikke laste leiligheter: ${err.message || 'Ukjent feil'}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [buildingId]);

  /**
   * Fetch apartments when drawer opens
   */
  useEffect(() => {
    if (isOpen && buildingId) {
      fetchApartments();
    }
  }, [isOpen, buildingId, fetchApartments]);

  /**
   * Reset state when drawer closes
   */
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setFilter('all');
      setError(null);
      setApartmentActionError({ id: null, message: '' });
      setCarrierInfo({
        is_talkmore_campaign: false,
        enriched_count: 0
      });
    }
  }, [isOpen]);

  /**
   * Add/remove body class to hide search bar when drawer is open
   */
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('apartment-drawer-open');
    } else {
      document.body.classList.remove('apartment-drawer-open');
    }
    return () => {
      document.body.classList.remove('apartment-drawer-open');
    };
  }, [isOpen]);

  /**
   * Apartment PATCH:
   * - Talkmore: Nei can include `nei_subcategory` (string or null).
   * - Non-Talkmore: Nei is status-only; do not send `nei_subcategory`.
   * Notes still travel together with status (no separate notes-only PATCH).
   */
  const handleStatusChange = async (apartmentId, newStatus, notes = null, apartmentData = null, neiSubcategory = undefined) => {
    const apartment = apartments.find(apt => apt.id === apartmentId);

    if (
      carrierInfo.is_talkmore_campaign &&
      newStatus === 'nei' &&
      neiSubcategory != null &&
      neiSubcategory !== '' &&
      !isNeiSubcategory(neiSubcategory)
    ) {
      setApartmentActionError({
        id: apartmentId,
        message: 'Ugyldig årsak for Nei.',
      });
      return { success: false };
    }
    setApartmentActionError((prev) =>
      prev.id === apartmentId ? { id: null, message: '' } : prev
    );

    // 🔑 NRC CAMPAIGN: Open URL IMMEDIATELY (before any await) to avoid popup blocker
    // Browser blocks window.open() if called after async operations
    if (newStatus === 'ja' && apartment && isNRCCampaign()) {
      console.log('[ApartmentListDrawer] NRC campaign detected, opening external URL BEFORE async operations');
      openNRCUrlForApartment(baseAddress, apartment.apartment_number);
    }
    
    // Optimistic update
    setApartments(prev => prev.map(apt => 
      apt.id === apartmentId 
        ? { 
            ...apt, 
            status: newStatus, 
            is_visited: newStatus !== null,
            notes: notes || apt.notes,
            nei_subcategory: newStatus === 'nei'
              ? (carrierInfo.is_talkmore_campaign
                  ? (neiSubcategory !== undefined ? neiSubcategory : null)
                  : null)
              : null,
          }
        : apt
    ));
    
    // Track updating state
    setUpdatingIds(prev => new Set(prev).add(apartmentId));

    try {
      const aptOptions = {};
      if (
        carrierInfo.is_talkmore_campaign &&
        newStatus === 'nei' &&
        neiSubcategory !== undefined
      ) {
        aptOptions.neiSubcategory = neiSubcategory;
      }
      const updated = await buildingService.updateApartmentStatus(
        apartmentId,
        newStatus,
        notes,
        aptOptions
      );
      setApartments(prev => prev.map(apt =>
        apt.id === apartmentId
          ? {
              ...apt,
              status: updated.status,
              is_visited: updated.is_visited != null ? updated.is_visited : updated.status != null,
              nei_subcategory: Object.prototype.hasOwnProperty.call(updated, 'nei_subcategory')
                ? updated.nei_subcategory
                : apt.nei_subcategory,
              notes: updated.notes !== undefined ? updated.notes : apt.notes,
              building_status: updated.building_status ?? apt.building_status,
            }
          : apt
      ));
      
      // Notify parent to refresh tiles
      if (onTileRefresh) {
        onTileRefresh();
      }
      
      // If status is 'ja', handle campaign form (NRC already opened above before await)
      if (newStatus === 'ja' && apartment) {
        if (isNRCCampaign()) {
          // NRC URL already opened above, just close the drawer
          onClose();
        } else if (onOpenCampaignForm) {
          // Other campaigns (not NRC) - open campaign form
          // Get campaign ID from localStorage
          const campaignData = localStorage.getItem('currentCampaign');
          let campaignId = null;
          if (campaignData) {
            try {
              const campaign = JSON.parse(campaignData);
              campaignId = campaign.id;
            } catch (e) {
              campaignId = campaignData;
            }
          }
          
          // Get user info from localStorage
          const userStr = localStorage.getItem('user');
          let salesRepId = null;
          if (userStr) {
            try {
              const user = JSON.parse(userStr);
              salesRepId = user.user_info?.id || user.id;
            } catch (e) {}
          }
          
          // Build address data for the form
          const addressData = {
            address_text: `${baseAddress}, ${apartment.apartment_number}`,
            postnummer: '',
            posted: '',
            apartment_number: apartment.apartment_number
          };
          
          // Close the drawer first, then open campaign form
          onClose();
          
          // Small delay to let drawer close animation complete
          setTimeout(() => {
            onOpenCampaignForm(campaignId, apartmentId, salesRepId, addressData);
          }, 200);
        }
      }
      return { success: true };
    } catch (err) {
      console.error('[ApartmentListDrawer] Error updating status:', err);
      setApartmentActionError({
        id: apartmentId,
        message: err?.message || 'Kunne ikke lagre besøk.',
      });
      fetchApartments(false);
      return { success: false };
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(apartmentId);
        return next;
      });
    }
  };

  /**
   * Handle drawer close
   */
  const handleClose = () => {
    // Refresh tiles when closing to ensure map shows updated colors
    if (onTileRefresh) {
      onTileRefresh();
    }
    onClose();
  };

  /**
   * Filter apartments based on filter and search
   */
  const filteredApartments = apartments.filter(apt => {
    // Filter by status
    if (filter === 'unvisited' && apt.is_visited) return false;
    if (filter === 'completed' && !apt.is_visited) return false;
    
    // Filter by carrier status (only for Talkmore campaigns)
    if (filter === 'with_carrier' && apt.carrier_status !== 'telenor_talkmore_available') return false;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return apt.apartment_number.toLowerCase().includes(query);
    }
    
    return true;
  });

  /**
   * Stop event propagation
   */
  const stopPropagation = (e) => {
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  if (!isOpen) return null;

  const drawerContent = (
    <div 
      className="apartment-drawer-overlay"
      onClick={handleClose}
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <div 
        className="apartment-drawer"
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
      >
        {/* Sticky Header */}
        <div className="drawer-header">
          <button 
            className="back-btn" 
            onClick={handleClose}
            aria-label="Tilbake"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          
          <div className="header-title">
            <FontAwesomeIcon icon={faBuilding} className="header-icon" />
            <div className="header-text">
              <h2>{baseAddress || 'Leiligheter'}</h2>
              <span className="header-subtitle">
                {visitedCount} av {totalCount} besøkt
              </span>
            </div>
          </div>
          
          <button 
            className="close-btn" 
            onClick={handleClose}
            aria-label="Lukk"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="drawer-stats-bar">
          <div className="stats-progress">
            <div 
              className="stats-progress-fill"
              style={{ width: `${totalCount > 0 ? (visitedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <div className="stats-numbers">
            <span className="stats-visited">
              <FontAwesomeIcon icon={faCheckCircle} /> {visitedCount} besøkt
            </span>
            <span className="stats-remaining">
              <FontAwesomeIcon icon={faCircle} /> {unvisitedCount} gjenstår
            </span>
          </div>
        </div>

        {/* Talkmore Campaign Banner */}
        {carrierInfo.is_talkmore_campaign && (
          <div className="talkmore-campaign-banner">
            <span className="banner-icon">📱</span>
            <span className="banner-text">
              Talkmore Campaign - {carrierInfo.enriched_count} enriched addresses
            </span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Alle ({totalCount})
          </button>
          <button 
            className={`filter-tab ${filter === 'unvisited' ? 'active' : ''}`}
            onClick={() => setFilter('unvisited')}
          >
            Ikke besøkt ({unvisitedCount})
          </button>
          <button 
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Fullført ({visitedCount})
          </button>
          {/* Carrier filter - only show for Talkmore campaigns */}
          {carrierInfo.is_talkmore_campaign && (
            <button 
              className={`filter-tab ${filter === 'with_carrier' ? 'active' : ''}`}
              onClick={() => setFilter('with_carrier')}
            >
              Med operatør ({carrierCount})
            </button>
          )}
        </div>

        {/* Search */}
        <div className="search-container">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Søk leilighet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Tøm søk"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>

        {/* Refresh Button */}
        {!isLoading && (
          <button 
            className="refresh-btn"
            onClick={() => fetchApartments(false)}
            disabled={isRefreshing}
          >
            <FontAwesomeIcon icon={faSyncAlt} spin={isRefreshing} />
            {isRefreshing ? 'Oppdaterer...' : 'Oppdater liste'}
          </button>
        )}

        {/* Apartment List */}
        <div className="apartment-list">
          {isLoading ? (
            // Skeleton loading
            <div className="loading-skeleton">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton-item">
                  <div className="skeleton-header">
                    <div className="skeleton-badge" />
                    <div className="skeleton-text" />
                  </div>
                  <div className="skeleton-buttons" />
                </div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="error-state">
              <p>{error}</p>
              <button onClick={() => fetchApartments()}>
                Prøv igjen
              </button>
            </div>
          ) : filteredApartments.length === 0 ? (
            // Empty state
            <div className="empty-state">
              {searchQuery ? (
                <p>Ingen leiligheter matcher "{searchQuery}"</p>
              ) : filter === 'unvisited' ? (
                <p>🎉 Alle leiligheter er besøkt!</p>
              ) : filter === 'completed' ? (
                <p>Ingen leiligheter er besøkt ennå</p>
              ) : (
                <p>Ingen leiligheter funnet</p>
              )}
            </div>
          ) : (
            // Apartment list
            filteredApartments.map(apt => (
              <ApartmentListItem
                key={apt.id}
                apartment={apt}
                onStatusChange={handleStatusChange}
                isUpdating={updatingIds.has(apt.id)}
                isTalkmoreCampaign={carrierInfo.is_talkmore_campaign}
                actionError={
                  apartmentActionError.id === apt.id
                    ? apartmentActionError.message
                    : null
                }
                onClearRowError={(id) =>
                  setApartmentActionError((prev) =>
                    prev.id === id ? { id: null, message: '' } : prev
                  )
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Render using portal
  return ReactDOM.createPortal(drawerContent, document.body);
};

export default ApartmentListDrawer;

