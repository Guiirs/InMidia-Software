import RealtimeProvider from './RealtimeProvider.jsx';
import { OperationalStateProvider } from './OperationalStateProvider.jsx';
import { V4ThemeProvider } from './ThemeProvider.jsx';

export function RuntimeProvider({ children, density = 'default' }) {
  return (
    <V4ThemeProvider defaultDensity={density}>
      <RealtimeProvider>
        <OperationalStateProvider>
          {children}
        </OperationalStateProvider>
      </RealtimeProvider>
    </V4ThemeProvider>
  );
}
