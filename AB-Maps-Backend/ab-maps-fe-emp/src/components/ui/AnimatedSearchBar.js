import React, { useState, useRef, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';
import './AnimatedSearchBar.css';

const AnimatedSearchBar = ({ onSearch, suggestions = [], onSuggestionClick, loading }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleIconClick = () => {
    setOpen(true);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
    setOpen(false);
    setQuery('');
  };

  const handleBlur = (e) => {
    // If focus moves to suggestion dropdown, don't close
    setTimeout(() => {
      if (document.activeElement.className !== 'search-suggestion') {
        setOpen(false);
        setQuery('');
      }
    }, 120);
  };

  const handleSuggestionClick = (suggestion) => {
    if (onSuggestionClick) onSuggestionClick(suggestion);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={`animated-search-bar-container${open ? ' open' : ''}`}>  
      <form
        className={`animated-search-bar${open ? ' open' : ''}`}
        onSubmit={handleSubmit}
        autoComplete="off"
        style={{ boxShadow: open ? '0 6px 24px rgba(41,128,185,0.13)' : '0 2px 8px rgba(44,62,80,0.08)' }}
      >
        <div
          className={`search-icon-circle${open ? ' open' : ''}`}
          onClick={handleIconClick}
          tabIndex={0}
        >
          <FaSearch className="search-icon" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search area or address..."
          value={query}
          onChange={handleInputChange}
          onBlur={handleBlur}
          style={{ width: open ? 240 : 0, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        />
      </form>
      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div className="search-suggestions-dropdown">
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className="search-suggestion"
              tabIndex={0}
              onClick={() => handleSuggestionClick(s)}
            >
              {s.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnimatedSearchBar; 