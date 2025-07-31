import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Key, Zap, CreditCard, Download, Trash2, Shield, Calendar, Brain, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

const handleExportData = () => {
  // TODO: Implement data export
  console.log('Exporting user data...');
};

const handleDeleteAccount = () => {
  // TODO: Implement account deletion
  console.log('Deleting account...');
};

export default function Settings() {
  const [isSync90DaysLoading, setIsSync90DaysLoading] = useState(false);
  const [isProcessEventsLoading, setIsProcessEventsLoading] = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState<number | null>(null);

  const handleSync90Days = async () => {
    setIsSync90DaysLoading(true);
    try {
      await apiRequest('POST', '/api/calendar/sync-90-days');
      alert('90-day calendar sync completed successfully!');
      // Refresh unprocessed count
      fetchUnprocessedCount();
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to sync calendar data. Please try again.');
    } finally {
      setIsSync90DaysLoading(false);
    }
  };

  const handleProcessEvents = async () => {
    setIsProcessEventsLoading(true);
    try {
      await apiRequest('POST', '/api/calendar/process-events');
      alert('Calendar events processed successfully!');
      // Refresh unprocessed count
      fetchUnprocessedCount();
    } catch (error) {
      console.error('Processing error:', error);
      alert('Failed to process calendar events. Please try again.');
    } finally {
      setIsProcessEventsLoading(false);
    }
  };

  const fetchUnprocessedCount = async () => {
    try {
      const response = await apiRequest('GET', '/api/calendar/unprocessed-count');
      const data = await response.json() as { count: number };
      setUnprocessedCount(data.count);
    } catch (error) {
      console.error('Failed to fetch unprocessed count:', error);
    }
  };

  // Fetch unprocessed count on component mount
  useEffect(() => {
    fetchUnprocessedCount();
  }, []);

  return (
    <div className='space-y-6'>
  <div>
    <h1 className='text-3xl font-bold tracking-tight'>Settings</h1>
    <p className='text-muted-foreground'>Manage your account settings and preferences.</p>
  </div>

  <div className='grid gap-6'>
    {/* Password Options */}
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Key className='h-5 w-5' />
          Password Options
        </CardTitle>
        <CardDescription>Manage your password and authentication settings.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>Google Authentication</p>
            <p className='text-sm text-muted-foreground'>You're signed in with Google OAuth</p>
          </div>
          <Badge variant='secondary'>Active</Badge>
        </div>
        <Separator />
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>Two-Factor Authentication</p>
            <p className='text-sm text-muted-foreground'>
              Add an extra layer of security to your account
            </p>
          </div>
          <Button variant='outline' size='sm'>
            <Shield className='h-4 w-4 mr-2' />
            Enable 2FA
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Integrations */}
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Zap className='h-5 w-5' />
          Integrations
        </CardTitle>
        <CardDescription>Connect and manage your third-party integrations.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>Google Workspace</p>
            <p className='text-sm text-muted-foreground'>Gmail, Calendar, and Drive integration</p>
          </div>
          <Badge variant='default'>Connected</Badge>
        </div>
        <Separator />
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>OpenAI Integration</p>
            <p className='text-sm text-muted-foreground'>AI-powered insights and assistance</p>
          </div>
          <Badge variant='default'>Active</Badge>
        </div>
      </CardContent>
    </Card>

    {/* Calendar Data Management */}
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Calendar className='h-5 w-5' />
          Calendar Data Management
        </CardTitle>
        <CardDescription>Sync and process your Google Calendar events for client insights.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>90-Day Calendar Sync</p>
            <p className='text-sm text-muted-foreground'>
              Import the last 90 days of calendar events as raw data for AI processing
            </p>
          </div>
          <Button 
            onClick={handleSync90Days} 
            disabled={isSync90DaysLoading}
            variant='outline' 
            size='sm'
          >
            {isSync90DaysLoading ? (
              <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
            ) : (
              <RefreshCw className='h-4 w-4 mr-2' />
            )}
            {isSync90DaysLoading ? 'Syncing...' : 'Sync 90 Days'}
          </Button>
        </div>
        <Separator />
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>AI Event Processing</p>
            <p className='text-sm text-muted-foreground'>
              Analyze calendar events to extract client sessions and insights
              {unprocessedCount !== null && (
                <span className='block mt-1 font-medium text-orange-600'>
                  {unprocessedCount} events pending processing
                </span>
              )}
            </p>
          </div>
          <Button 
            onClick={handleProcessEvents} 
            disabled={isProcessEventsLoading}
            variant='outline' 
            size='sm'
          >
            {isProcessEventsLoading ? (
              <Brain className='h-4 w-4 mr-2 animate-spin' />
            ) : (
              <Brain className='h-4 w-4 mr-2' />
            )}
            {isProcessEventsLoading ? 'Processing...' : 'Process Events'}
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Subscription Options */}
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <CreditCard className='h-5 w-5' />
          Subscription Options
        </CardTitle>
        <CardDescription>Manage your subscription and billing information.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>Current Plan</p>
            <p className='text-sm text-muted-foreground'>
              Professional Plan - Full access to all features
            </p>
          </div>
          <Badge variant='default'>Active</Badge>
        </div>
        <Separator />
        <div className='flex gap-2'>
          <Button variant='outline' size='sm'>
            View Billing
          </Button>
          <Button variant='outline' size='sm'>
            Upgrade Plan
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* GDPR & Data Management */}
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Download className='h-5 w-5' />
          Data Management
        </CardTitle>
        <CardDescription>Export your data or delete your account.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>Export Data</p>
            <p className='text-sm text-muted-foreground'>Download all your data in JSON format</p>
          </div>
          <Button variant='outline' size='sm' onClick={handleExportData}>
            <Download className='h-4 w-4 mr-2' />
            Export
          </Button>
        </div>
        <Separator />
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>Delete Account</p>
            <p className='text-sm text-muted-foreground'>
              Permanently delete your account and all data
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant='destructive' size='sm'>
                <Trash2 className='h-4 w-4 mr-2' />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account and remove
                  all your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                >
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  </div>
    </div>
  );
}
