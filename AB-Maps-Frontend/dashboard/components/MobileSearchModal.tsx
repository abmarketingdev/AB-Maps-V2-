"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Clock, TrendingUp, FileText, User, MapPinned } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'page' | 'user' | 'address' | 'report';
  href: string;
}

// Mock search results - in real implementation, this would come from API
const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    title: 'Dashboard',
    description: 'Hoveddashbord med oversikt',
    type: 'page',
    href: '/'
  },
  {
    id: '2',
    title: 'Salg',
    description: 'Salgsoversikt og statistikker',
    type: 'page',
    href: '/sales'
  },
  {
    id: '3',
    title: 'Rapport',
    description: 'Generer og vis rapporter',
    type: 'page',
    href: '/rapport'
  },
  {
    id: '4',
    title: 'Todo',
    description: 'Oppgaveliste og prosjektstyring',
    type: 'page',
    href: '/todo'
  },
  {
    id: '5',
    title: 'John Doe',
    description: 'Salgsrepresentant - Oslo',
    type: 'user',
    href: '/users/1'
  },
  {
    id: '6',
    title: 'Storgata 1, Oslo',
    description: 'Potensiel kunde adresse',
    type: 'address',
    href: '/addresses/1'
  }
];

const getResultIcon = (type: SearchResult['type']) => {
  switch (type) {
    case 'page':
      return <FileText className="h-4 w-4" />;
    case 'user':
      return <User className="h-4 w-4" />;
    case 'address':
      return <MapPinned className="h-4 w-4" />;
    case 'report':
      return <TrendingUp className="h-4 w-4" />;
    default:
      return <Search className="h-4 w-4" />;
  }
};

const getResultTypeColor = (type: SearchResult['type']) => {
  switch (type) {
    case 'page':
      return 'text-blue-600';
    case 'user':
      return 'text-green-600';
    case 'address':
      return 'text-purple-600';
    case 'report':
      return 'text-orange-600';
    default:
      return 'text-gray-600';
  }
};

export function MobileSearchModal({ isOpen, onClose }: MobileSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Handle search with debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      const filteredResults = mockSearchResults.filter(result =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setResults(filteredResults);
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleResultClick = (result: SearchResult) => {
    // In real implementation, this would navigate to the result
    console.log('Navigate to:', result.href);
    onClose();
    setSearchQuery('');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle search submission if needed
    console.log('Search for:', searchQuery);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full h-full md:max-w-md md:h-auto m-0 md:m-4 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">Søk</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Search Input */}
          <div className="p-4 border-b">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Søk etter sider, brukere, adresser..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-12 text-base"
                autoFocus
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Search className="h-4 w-4 animate-pulse" />
                  <span>Søker...</span>
                </div>
              </div>
            ) : searchQuery && results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Ingen resultater funnet</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Prøv å søke med andre ord eller sjekk stavemåten
                </p>
              </div>
            ) : !searchQuery ? (
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Populære søk
                    </h3>
                    <div className="space-y-2">
                      {mockSearchResults.slice(0, 3).map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors w-full text-left"
                        >
                          <div className={cn("p-2 rounded-full bg-muted", getResultTypeColor(result.type))}>
                            {getResultIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{result.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {results.length} resultat{results.length !== 1 ? 'er' : ''} for "{searchQuery}"
                  </p>
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors w-full text-left"
                    >
                      <div className={cn("p-2 rounded-full bg-muted", getResultTypeColor(result.type))}>
                        {getResultIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{result.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer with recent searches */}
          {!searchQuery && (
            <div className="p-4 border-t bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Trykk ESC for å lukke</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
