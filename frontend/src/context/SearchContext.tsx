import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SellerScope {
  username: string;
  displayName?: string;
  avatar?: string;
}

interface SearchContextType {
  isSearchOpen: boolean;
  sellerScope: SellerScope | null;
  openSearch: () => void;
  openSearchForSeller: (seller: SellerScope) => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sellerScope, setSellerScope] = useState<SellerScope | null>(null);

  const openSearch = () => {
    setSellerScope(null);
    setIsSearchOpen(true);
  };

  const openSearchForSeller = (seller: SellerScope) => {
    setSellerScope(seller);
    setIsSearchOpen(true);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSellerScope(null);
  };

  const toggleSearch = () => setIsSearchOpen(prev => !prev);

  return (
    <SearchContext.Provider value={{ isSearchOpen, sellerScope, openSearch, openSearchForSeller, closeSearch, toggleSearch }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
