import React from 'react';
import { Switch, Route } from 'wouter';
import { queryClient } from './lib/queryClient.js';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster.js';
import { TooltipProvider } from '@/components/ui/tooltip.js';
import { ThemeProvider } from '@/contexts/ThemeContext.js';
import { AuthProvider } from '@/contexts/AuthContext.js';
import AuthenticatedRoute from '@/components/Layout/AuthenticatedRoute.js';
import Dashboard from '@/pages/Dashboard.js';
import Contacts from '@/pages/Contacts.js';
import Tasks from '@/pages/Tasks.js';
import AIAssistant from '@/pages/AIAssistant.js';
import Settings from '@/pages/Settings.js';
import Login from '@/pages/Login.js';
import NotFound from '@/pages/not-found.js';

function Router(): React.ReactElement {
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
      <Route path='/tasks'>
        <AuthenticatedRoute>
          <Tasks />
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

function App(): React.ReactElement {
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
