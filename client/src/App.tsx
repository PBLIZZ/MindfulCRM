import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import AuthenticatedRoute from '@/components/Layout/AuthenticatedRoute';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';

import AIAssistant from '@/pages/AIAssistant';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path='/login' component={Login} />
      <Route path='/'>
        <AuthenticatedRoute>
          <Dashboard />
        </AuthenticatedRoute>
      </Route>
      <Route path='/contacts'>
        <AuthenticatedRoute>
          <Contacts />
        </AuthenticatedRoute>
      </Route>


      <Route path='/assistant'>
        <AuthenticatedRoute>
          <AIAssistant />
        </AuthenticatedRoute>
      </Route>
      <Route path='/settings'>
        <AuthenticatedRoute>
          <Settings />
        </AuthenticatedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
