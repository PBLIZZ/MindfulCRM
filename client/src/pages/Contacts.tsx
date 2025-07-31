import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter, Mail, Phone, Calendar, MessageSquare, Upload, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AddContactDialog from '@/components/Contact/AddContactDialog';
import ContactDetail from '@/components/Contact/ContactDetail';
import { ContactsTable } from '@/components/Contact/ContactsTable';
import { ContactPhotoUpload } from '@/components/Contact/ContactPhotoUpload';
import { AIPhotoReview } from '@/components/Contact/AIPhotoReview';
import { DeleteContactDialog } from '@/components/Contact/DeleteContactDialog';
import { useToast } from '@/hooks/use-toast';
import type { Contact } from '@/components/Contact/ContactsTable';

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [photoUploadContact, setPhotoUploadContact] = useState<Contact | null>(null);
  const [aiPhotoReviewContact, setAiPhotoReviewContact] = useState<Contact | null>(null);
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const { toast } = useToast();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['/api/contacts'],
  }) as { data: Contact[]; isLoading: boolean };

  const handleBulkAction = async (action: string, contactIds: string[]) => {
    switch (action) {
      case 'export':
        await handleExportSelected(contactIds);
        break;
      case 'delete':
        // TODO: Implement bulk delete with confirmation
        console.log('Bulk delete:', contactIds);
        toast({
          title: 'Bulk Delete',
          description: 'Bulk delete functionality coming soon.',
        });
        break;
      default:
        console.log('Unknown bulk action:', action);
    }
  };

  const handleExportData = async (format: string) => {
    try {
      const response = await fetch(`/api/contacts/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Export successful',
          description: `Contacts exported as ${format.toUpperCase()}.`,
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export contacts. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleExportSelected = async (contactIds: string[]) => {
    try {
      const response = await fetch('/api/contacts/export-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ contactIds, format: 'json' })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected-contacts.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Export successful',
          description: `${contactIds.length} contacts exported.`,
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export selected contacts.',
        variant: 'destructive'
      });
    }
  };

  const filteredContacts =
    contacts?.filter((contact: any) => {
      const matchesSearch =
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
      case 'potential':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  const getInitials = (name: string) => {
    return (
      name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || '?'
    );
  };

  if (selectedContactId) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            onClick={() => setSelectedContactId(null)}
            className='flex items-center gap-2'
          >
            ← Back to Contacts
          </Button>
        </div>
        <ContactDetail contactId={selectedContactId} />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Contacts</h1>
          <p className='text-muted-foreground mt-1'>
            Manage your client relationships and interactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className='flex items-center gap-2'>
                <Sparkles className='h-4 w-4' />
                AI Tools
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => {
                // TODO: Batch AI photo enrichment
                toast({
                  title: 'AI Photo Enrichment',
                  description: 'Batch photo enrichment coming soon.',
                });
              }}>
                <Sparkles className="mr-2 h-4 w-4" />
                Enrich All Photos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportData('json')}>
                <Download className="mr-2 h-4 w-4" />
                Export All Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={() => setShowAddDialog(true)} className='flex items-center gap-2'>
            <Plus className='h-4 w-4' />
            Add Contact
          </Button>
        </div>
      </div>

      <div className='flex flex-col sm:flex-row gap-4'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
            <Input
              placeholder='Search contacts...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='pl-10'
            />
          </div>
      </div>

      {isLoading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {[...Array(6)].map((_, i) => (
              <Card key={i} className='animate-pulse'>
                <CardHeader className='flex flex-row items-center space-y-0 pb-2'>
                  <div className='h-10 w-10 bg-muted rounded-full' />
                  <div className='ml-3 space-y-1 flex-1'>
                    <div className='h-4 bg-muted rounded w-3/4' />
                    <div className='h-3 bg-muted rounded w-1/2' />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <div className='h-3 bg-muted rounded w-full' />
                    <div className='h-3 bg-muted rounded w-2/3' />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card className='text-center py-12'>
            <CardContent>
              <div className='text-muted-foreground mb-4'>
                {searchTerm ? (
                  <>No contacts found matching your criteria.</>
                ) : (
                  <>You haven't added any contacts yet.</>
                )}
              </div>
              <Button onClick={() => setShowAddDialog(true)} className='flex items-center gap-2'>
                <Plus className='h-4 w-4' />
                Add Your First Contact
              </Button>
            </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue='table'>
          <TabsList>
            <TabsTrigger value='table'>Table View</TabsTrigger>
            <TabsTrigger value='cards'>Card View</TabsTrigger>
          </TabsList>
          <TabsContent value='table'>
            <ContactsTable 
              contacts={filteredContacts} 
              onSelectContact={setSelectedContactId}
              onEditContact={(contact) => {
                // TODO: Open edit dialog
                console.log('Edit contact:', contact);
              }}
              onDeleteContact={setDeleteContact}
              onBulkAction={handleBulkAction}
              onExportData={handleExportData}
            />
          </TabsContent>
          <TabsContent value='cards'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {filteredContacts.map((contact: any) => (
                <Card
                  key={contact.id}
                  className='cursor-pointer hover:shadow-md transition-shadow'
                  onClick={() => setSelectedContactId(contact.id.toString())}
                >
                  <CardHeader className='flex flex-row items-center space-y-0 pb-2'>
                    <Avatar className='h-10 w-10'>
                      <AvatarImage src={contact.avatar} alt={contact.name} />
                      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className='ml-3 space-y-1 flex-1'>
                      <CardTitle className='text-sm font-medium'>{contact.name}</CardTitle>
                      <div className='flex items-center gap-2'>
                        <Badge variant='secondary' className={getStatusColor(contact.status)}>
                          {contact.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-2 text-sm text-muted-foreground'>
                      {contact.email && (
                        <div className='flex items-center gap-2'>
                          <Mail className='h-3 w-3' />
                          <span className='truncate'>{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className='flex items-center gap-2'>
                          <Phone className='h-3 w-3' />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                      <div className='flex items-center justify-between text-xs pt-2'>
                        <div className='flex items-center gap-4'>
                          {contact.lastInteraction && (
                            <div className='flex items-center gap-1'>
                              <MessageSquare className='h-3 w-3' />
                              <span>{new Date(contact.lastInteraction).toLocaleDateString()}</span>
                            </div>
                          )}
                          {contact.nextAppointment && (
                            <div className='flex items-center gap-1'>
                              <Calendar className='h-3 w-3' />
                              <span>{new Date(contact.nextAppointment).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <AddContactDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      
      {/* Photo Upload Dialog */}
      <ContactPhotoUpload
        contactId={photoUploadContact?.id || ''}
        contactName={photoUploadContact?.name || ''}
        currentPhotoUrl={photoUploadContact?.avatarUrl}
        open={!!photoUploadContact}
        onOpenChange={(open) => !open && setPhotoUploadContact(null)}
      />
      
      {/* AI Photo Review Dialog */}
      <AIPhotoReview
        contact={aiPhotoReviewContact}
        open={!!aiPhotoReviewContact}
        onOpenChange={(open) => !open && setAiPhotoReviewContact(null)}
      />
      
      {/* Delete Contact Dialog */}
      <DeleteContactDialog
        contact={deleteContact}
        open={!!deleteContact}
        onOpenChange={(open) => !open && setDeleteContact(null)}
      />
    </div>
  );
}
