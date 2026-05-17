import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { createRoot } from 'react-dom/client';
import MovementToggle from './MovementToggle';
import DrawingToggle from './DrawingToggle';
import FetchToggle from './FetchToggle';
import DeleteToggle from './DeleteToggle';
import EnrichmentJobButton from './EnrichmentJobButton';
// DEPRECATED: AgeStatsToggle removed - feature temporarily disabled
// import AgeStatsToggle from './AgeStatsToggle';

/**
 * Component for map toolbar with drawing controls
 */
const Toolbar = ({ 
  isDrawingEnabled, 
  onToggleDrawing, 
  isMovementMode, 
  onToggleMovement, 
  onCleanupAreaState, 
  onFetchAreas, 
  isFetchingAreas,
  // Delete mode props
  isDeleteMode = false,
  onToggleDeleteMode,
  // Phase 7: Enrichment job tracking props
  activeEnrichmentJobsCount = 0,
  onEnrichmentJobClick
  // DEPRECATED: Age Stats props removed
  // onOpenAgeStats,
  // isAgeStatsLoading,
  // isAgeStatsOpen
}) => {
  const map = useMap();
  const rootRef = useRef(null);
  const controlRef = useRef(null);

  useEffect(() => {
    if (map && !controlRef.current) {
      const CustomControl = L.Control.extend({
        onAdd: function (map) {
          const container = L.DomUtil.create('div', 'leaflet-bar toolbar-container');
          
          // This is the key: stop all clicks from propagating to the map, guaranteed.
          L.DomEvent.disableClickPropagation(container);
          
          rootRef.current = createRoot(container);
          rootRef.current.render(
            <div className="toolbar-controls">
              <DrawingToggle
                isDrawingEnabled={isDrawingEnabled}
                onToggle={onToggleDrawing}
                disabled={isDeleteMode} // Disable drawing when in delete mode
              />
              <MovementToggle
                isMovementMode={isMovementMode}
                onToggle={() => onToggleMovement(onCleanupAreaState)}
                disabled={isDeleteMode} // Disable movement when in delete mode
              />
              <FetchToggle
                onFetch={onFetchAreas}
                disabled={isDeleteMode} // Disable fetch when in delete mode
                isLoading={isFetchingAreas}
              />
              {/* Delete Toggle */}
              <div className="delete-toggle-separator" />
              <DeleteToggle
                isDeleteMode={isDeleteMode}
                onToggle={onToggleDeleteMode}
                disabled={false}
              />
              {/* Phase 7: Enrichment Job Button */}
              {activeEnrichmentJobsCount > 0 && (
                <>
                  <div className="delete-toggle-separator" />
                  <EnrichmentJobButton
                    activeJobsCount={activeEnrichmentJobsCount}
                    onClick={onEnrichmentJobClick}
                    disabled={isDeleteMode}
                  />
                </>
              )}
              {/* DEPRECATED: AgeStatsToggle removed - feature temporarily disabled */}
              {/* <AgeStatsToggle
                onClick={onOpenAgeStats}
                disabled={false}
                isLoading={isAgeStatsLoading}
                isOpen={isAgeStatsOpen}
              /> */}
            </div>
          );
          
          return container;
        },
        onRemove: function (map) {
          if (rootRef.current) {
            rootRef.current.unmount();
            rootRef.current = null;
          }
        },
      });

      const control = new CustomControl({ position: 'topleft' });
      map.addControl(control);
      controlRef.current = control;
    }

    // This part handles dynamically updating the state of all controls
    if (rootRef.current) {
      rootRef.current.render(
        <div className="toolbar-controls">
          <DrawingToggle
            isDrawingEnabled={isDrawingEnabled}
            onToggle={onToggleDrawing}
            disabled={isDeleteMode} // Disable drawing when in delete mode
          />
          <MovementToggle
            isMovementMode={isMovementMode}
            onToggle={() => onToggleMovement(onCleanupAreaState)}
            disabled={isDeleteMode} // Disable movement when in delete mode
          />
          <FetchToggle
            onFetch={onFetchAreas}
            disabled={isDeleteMode} // Disable fetch when in delete mode
            isLoading={isFetchingAreas}
          />
          {/* Delete Toggle */}
          <div className="delete-toggle-separator" />
          <DeleteToggle
            isDeleteMode={isDeleteMode}
            onToggle={onToggleDeleteMode}
            disabled={false}
          />
          {/* Phase 7: Enrichment Job Button */}
          {activeEnrichmentJobsCount > 0 && (
            <>
              <div className="delete-toggle-separator" />
              <EnrichmentJobButton
                activeJobsCount={activeEnrichmentJobsCount}
                onClick={onEnrichmentJobClick}
                disabled={isDeleteMode}
              />
            </>
          )}
          {/* DEPRECATED: AgeStatsToggle removed - feature temporarily disabled */}
          {/* <AgeStatsToggle
            onClick={onOpenAgeStats}
            disabled={false}
            isLoading={isAgeStatsLoading}
            isOpen={isAgeStatsOpen}
          /> */}
        </div>
      );
    }

  }, [map, isDrawingEnabled, onToggleDrawing, isMovementMode, onToggleMovement, onCleanupAreaState, onFetchAreas, isFetchingAreas, isDeleteMode, onToggleDeleteMode, activeEnrichmentJobsCount, onEnrichmentJobClick]);

  return null; // The component renders itself into the map, not here
};

export default Toolbar;


