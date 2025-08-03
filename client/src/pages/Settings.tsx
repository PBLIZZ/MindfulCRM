import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Separator } from '@/components/ui/separator.js';
import { Badge } from '@/components/ui/badge.js';
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
} from '@/components/ui/alert-dialog.js';
import { Key, Zap, CreditCard, Download, Trash2, Shield, Calendar, Brain, RefreshCw, Eye, ExternalLink, Camera, Users, Clock, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Label } from '@/components/ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';


const handleExportData = async () => {
  try {
    const response = await fetch('/api/contacts/export?format=json', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts-export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      alert('Data exported successfully!');
    } else {
      throw new Error('Export failed');
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export data. Please try again.');
  }
};

const handleDeleteAccount = () => {
  // TODO: Implement account deletion
  console.log('Deleting account...');
};

export default function Settings() {
  const [isHistoricalSyncLoading, setIsHistoricalSyncLoading] = useState(false);
  const [isProcessEventsLoading, setIsProcessEventsLoading] = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState<number | null>(null);
  const [allowProfilePictureScraping, setAllowProfilePictureScraping] = useState(false);
  const [isUpdatingConsent, setIsUpdatingConsent] = useState(false);
  
  const [syncMonths, setSyncMonths] = useState(12);
  const [usePremiumModel, setUsePremiumModel] = useState(false);
  
  const [syncStats, setSyncStats] = useState<any>(null);

  const handleHistoricalSync = async () => {
    setIsHistoricalSyncLoading(true);
    try {
      const response = await apiRequest('POST', '/api/calendar/sync-historical', {
        months: syncMonths,
        usePremiumModel
      });
      const result = await response.json();
      alert(`Historical sync completed! ${result.message}`);
      // Refresh counts
      fetchUnprocessedCount();
      fetchSyncStats();
    } catch (error) {
      console.error('Historical sync error:', error);
      alert('Failed to sync historical calendar data. Please try again.');
    } finally {
      setIsHistoricalSyncLoading(false);
    }
  };

  const handleProcessEvents = async () => {
    setIsProcessEventsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/calendar/process-events', {
        batchSize: 25
      });
      const result = await response.json();
      alert(`Event processing completed! ${result.message}`);
      // Refresh counts
      fetchUnprocessedCount();
      fetchSyncStats();
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

  const fetchSyncStats = async () => {
    try {
      const response = await apiRequest('GET', '/api/calendar/sync-stats');
      const data = await response.json();
      setSyncStats(data);
    } catch (error) {
      console.error('Failed to fetch sync stats:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await apiRequest('GET', '/api/profile');
      const data = await response.json();
      setAllowProfilePictureScraping(data.allowProfilePictureScraping || false);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const handleGdprConsentChange = async (checked: boolean) => {
    setIsUpdatingConsent(true);
    try {
      const requestBody = {
        allowProfilePictureScraping: checked,
        gdprConsentDate: new Date().toISOString(),
        gdprConsentVersion: '1.0'
      };
      
      console.log('Sending GDPR consent update:', requestBody);
      
      const response = await apiRequest('PATCH', '/api/profile/gdpr-consent', requestBody);
      
      const updatedUser = await response.json();
      setAllowProfilePictureScraping(updatedUser.allowProfilePictureScraping);
      
      if (checked) {
        alert('GDPR consent granted. You can now send consent forms to clients and begin profile picture enrichment.');
      } else {
        alert('GDPR consent revoked. Profile picture scraping has been disabled.');
      }
    } catch (error) {
      console.error('Failed to update GDPR consent:', error);
      alert('Failed to update consent settings. Please try again.');
      // Revert the checkbox state on error
      setAllowProfilePictureScraping(!checked);
    } finally {
      setIsUpdatingConsent(false);
    }
  };

  const openConsentForm = () => {
    window.open('/gdpr-consent-form-template.html', '_blank');
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchUnprocessedCount();
    fetchUserProfile();
    fetchSyncStats();
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
          Intelligent Calendar Management
        </CardTitle>
        <CardDescription>Sync and process your Google Calendar events with AI-powered filtering and deduplication.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Sync Statistics */}
        {syncStats && (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg'>
            <div className='text-center'>
              <p className='text-2xl font-bold text-teal-600'>{syncStats.totalEvents}</p>
              <p className='text-xs text-muted-foreground'>Total Events</p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-bold text-green-600'>{syncStats.processedEvents}</p>
              <p className='text-xs text-muted-foreground'>Processed</p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-bold text-orange-600'>{syncStats.unprocessedEvents}</p>
              <p className='text-xs text-muted-foreground'>Pending</p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-bold text-blue-600'>{syncStats.futureEvents}</p>
              <p className='text-xs text-muted-foreground'>Future Events</p>
            </div>
          </div>
        )}
        
        {/* Historical Sync */}
        <div className='space-y-4'>
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <p className='font-medium flex items-center gap-2'>
                <Clock className='h-4 w-4' />
                Historical Calendar Sync
              </p>
              <p className='text-sm text-muted-foreground mt-1'>
                One-time import of historical calendar events with intelligent filtering
              </p>
            </div>
          </div>
          
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='sync-months'>Time Period (Months)</Label>
              <Select value={syncMonths.toString()} onValueChange={(value) => setSyncMonths(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='1'>1 Month</SelectItem>
                  <SelectItem value='3'>3 Months</SelectItem>
                  <SelectItem value='6'>6 Months</SelectItem>
                  <SelectItem value='12'>1 Year (Recommended)</SelectItem>
                  <SelectItem value='18'>18 Months</SelectItem>
                  <SelectItem value='24'>2 Years (Max)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className='space-y-2'>
              <Label>Model Selection</Label>
              <div className='flex items-center space-x-2'>
                <Checkbox 
                  id='use-free-model'
                  checked={!usePremiumModel}
                  onCheckedChange={(checked) => setUsePremiumModel(!checked)}
                />
                <Label htmlFor='use-free-model' className='text-sm'>
                  Use free model (recommended for bulk processing)
                </Label>
              </div>
            </div>
          </div>
          
          <div className='flex justify-end'>
            <Button 
              onClick={handleHistoricalSync} 
              disabled={isHistoricalSyncLoading}
              variant='outline' 
              size='sm'
            >
              {isHistoricalSyncLoading ? (
                <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <RefreshCw className='h-4 w-4 mr-2' />
              )}
              {isHistoricalSyncLoading ? 'Syncing...' : `Sync ${syncMonths} Month${syncMonths !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
        
        <Separator />
        
        {/* Ongoing Processing */}
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <p className='font-medium flex items-center gap-2'>
              <Brain className='h-4 w-4' />
              Smart Event Processing
            </p>
            <p className='text-sm text-muted-foreground'>
              Process unprocessed events with premium AI model and intelligent filtering
              {unprocessedCount !== null && unprocessedCount > 0 && (
                <span className='block mt-1 font-medium text-orange-600'>
                  {unprocessedCount} events pending processing
                </span>
              )}
            </p>
            <div className='flex items-center space-x-2 mt-2'>
              <Checkbox 
                id='use-premium-model'
                checked={usePremiumModel}
                onCheckedChange={(checked) => setUsePremiumModel(checked === true)}
              />
              <Label htmlFor='use-premium-model' className='text-sm'>
                Use premium model (better accuracy, higher cost)
              </Label>
            </div>
          </div>
          <Button 
            onClick={handleProcessEvents} 
            disabled={isProcessEventsLoading || (unprocessedCount === 0)}
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

    {/* Privacy & GDPR Settings */}
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Eye className='h-5 w-5' />
          Privacy & GDPR Settings
        </CardTitle>
        <CardDescription>Manage your privacy settings and consent for data processing.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-4'>
          <div className='flex items-start space-x-3'>
            <Checkbox 
              id='gdpr-consent'
              checked={allowProfilePictureScraping}
              onCheckedChange={handleGdprConsentChange}
              disabled={isUpdatingConsent}
            />
            <div className='space-y-1 leading-none'>
              <Label htmlFor='gdpr-consent' className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                Allow Profile Picture Scraping
              </Label>
              <p className='text-xs text-muted-foreground'>
                I consent to the collection of public profile pictures from social media platforms (LinkedIn, Facebook, X, Instagram, GitHub) for client contact enhancement. This enables sending GDPR consent forms to clients and enriching their profiles with public images.
              </p>
            </div>
          </div>
          
          {allowProfilePictureScraping && (
            <div className='ml-6 p-4 bg-green-50 border border-green-200 rounded-lg'>
              <div className='flex items-center gap-2 text-green-700 font-medium mb-2'>
                <Shield className='h-4 w-4' />
                GDPR Consent Active
              </div>
              <p className='text-sm text-green-600 mb-3'>
                You have enabled profile picture scraping. You can now send consent forms to clients and begin enriching their contact records with public social media profile pictures.
              </p>
              <div className='flex gap-2'>
                <Button
                  onClick={openConsentForm}
                  variant='outline'
                  size='sm'
                  className='text-green-700 border-green-300 hover:bg-green-100'
                >
                  <ExternalLink className='h-4 w-4 mr-2' />
                  View Consent Form Template
                </Button>
              </div>
            </div>
          )}
          
          {!allowProfilePictureScraping && (
            <div className='ml-6 p-4 bg-amber-50 border border-amber-200 rounded-lg'>
              <div className='flex items-center gap-2 text-amber-700 font-medium mb-2'>
                <Shield className='h-4 w-4' />
                GDPR Consent Required
              </div>
              <p className='text-sm text-amber-600'>
                To enable profile picture scraping for client contacts, you must first consent to the data processing. This will allow you to:
              </p>
              <ul className='text-sm text-amber-600 mt-2 ml-4 list-disc'>
                <li>Send GDPR consent forms to clients</li>
                <li>Scrape public profile pictures from social media</li>
                <li>Enhance client contact records with profile images</li>
                <li>Use fallback avatars for non-consented clients</li>
              </ul>
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className='flex items-center justify-between'>
          <div>
            <p className='font-medium'>Data Processing Agreement</p>
            <p className='text-sm text-muted-foreground'>
              Review the full GDPR consent form and data processing terms
            </p>
          </div>
          <Button
            onClick={openConsentForm}
            variant='outline'
            size='sm'
          >
            <ExternalLink className='h-4 w-4 mr-2' />
            View Form
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
