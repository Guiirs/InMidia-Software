import { createContext, useContext, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

export function V4ThemeProvider({ children, defaultDensity = 'default' }) {
  const [density, setDensity] = useState(defaultDensity);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const value = {
    density,
    setDensity,
    sidebarCollapsed,
    toggleSidebar,
    theme: 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useV4Theme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useV4Theme deve ser usado dentro de V4ThemeProvider');
  return ctx;
}
