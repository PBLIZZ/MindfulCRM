import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Phone, MessageSquare, Edit } from 'lucide-react';

import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import AddContactDialog from '@/components/Contact/AddContactDialog.js';
import ContactDetail from '@/components/Contact/ContactDetail.js';
import { ContactsTable } from '@/components/Contact/ContactsTable.js';
import { ContactPhotoUpload } from '@/components/Contact/ContactPhotoUpload.js';
import { AIPhotoReview } from '@/components/Contact/AIPhotoReview.js';
import { DeleteContactDialog } from '@/components/Contact/DeleteContactDialog.js';
import { EditContactModal } from '@/components/Contact/EditContactModal.js';
import { TagSelectionDialog } from '@/components/Contact/TagSelectionDialog.js';
import { useToast } from '@/hooks/use-toast.js';
import type { Contact } from '@/components/Contact/ContactsTable.js';

// Type definitions for tag operations
interface TagData {
  id: string;
  name: string;
  color: string;
}

export default function Contacts() {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [tagAction, setTagAction] = useState<{ type: 'add' | 'remove'; contactIds: string[] } | null>(null);
  const [photoUploadContact, setPhotoUploadContact] = useState<Contact | null>(null);
  const [aiPhotoReviewContact, setAiPhotoReviewContact] = useState<Contact | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['/api/contacts'],
  }) as { data: Contact[]; isLoading: boolean };

  const handleBulkPhotoEnrichment = async (contactIds: string[]) => {
    try {
      toast({
        title: 'Photo Enrichment Started',
        description: `Starting photo enrichment for ${contactIds.length} contact(s)...`,
      });

      let successCount = 0;
      let failureCount = 0;

      // Process each contact individually
      for (const contactId of contactIds) {
        try {
          const response = await fetch(`/api/contacts/${contactId}/enrich-photo`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to enrich photo: ${response.status}`);
          }

          successCount++;
        } catch {
          failureCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        toast({
          title: 'Photo Enrichment Complete',
          description: `✅ ${successCount} photo(s) enriched successfully${failureCount > 0 ? `, ❌ ${failureCount} failed` : ''}`,
        });
      } else {
        toast({
          title: 'Photo Enrichment Failed',
          description: 'No photos could be enriched. Please try again or contact support.',
          variant: 'destructive'
        });
      }

      // Refresh the contacts list to show updated photos
      await queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    } catch {
      toast({
        title: 'Photo Enrichment Error',
        description: 'An error occurred during photo enrichment. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleBulkAddTag = async (tag: TagData, contactIds: string[]) => {
    try {
      // Show loading state immediately
      toast({
        title: 'Adding tag...',
        description: `Adding "${tag.name}" to ${contactIds.length} contact(s)...`,
      });

      const response = await fetch('/api/contacts/bulk/add-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          contactIds,
          tagId: tag.id,
          tagName: tag.name,
          tagColor: tag.color,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Tag added',
          description: `Added "${tag.name}" tag to ${contactIds.length} contact(s).`,
        });
        // Use React Query to refresh data instead of page reload
        window.location.reload();
      } else {
        throw new Error('Failed to add tag');
      }
    } catch {
      toast({
        title: 'Error adding tag',
        description: 'Failed to add tag to contacts. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkRemoveTag = async (tag: TagData, contactIds: string[]) => {
    try {
      // Show loading state immediately
      toast({
        title: 'Removing tag...',
        description: `Removing "${tag.name}" from ${contactIds.length} contact(s)...`,
      });

      const response = await fetch('/api/contacts/bulk/remove-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          contactIds,
          tagId: tag.id,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Tag removed',
          description: `Removed "${tag.name}" tag from ${contactIds.length} contact(s).`,
        });
        // Refresh contacts data
        window.location.reload();
      } else {
        throw new Error('Failed to remove tag');
      }
    } catch {
      toast({
        title: 'Error removing tag',
        description: 'Failed to remove tag from contacts. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkAction = async (action: string, contactIds: string[]) => {
    switch (action) {
      case 'enrich_photos':
        await handleBulkPhotoEnrichment(contactIds);
        break;
      case 'export':
        await handleExportSelected(contactIds);
        break;
      case 'add_tag':
        setTagAction({ type: 'add', contactIds });
        break;
      case 'remove_tag':
        setTagAction({ type: 'remove', contactIds });
        break;
      case 'delete':
        // TODO: Implement bulk delete with confirmation
        toast({
          title: 'Bulk Delete',
          description: 'Bulk delete functionality coming soon.',
        });
        break;
      default:
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
    } catch {
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
    } catch {
      toast({
        title: 'Export failed',
        description: 'Failed to export selected contacts.',
        variant: 'destructive'
      });
    }
  };

  const handleAITool = (tool: string) => {
    switch (tool) {
      case 'enrich_photos':
        toast({
          title: 'AI Photo Enrichment',
          description: 'Batch photo enrichment coming soon.',
        });
        break;
      default:
    }
  };

  const allContacts = contacts ?? [];

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
        <ContactDetail
          contactId={selectedContactId}
          onEditContact={(contact) => {
            // Convert ContactWithDetails to Contact by extracting base properties
            const { interactions, goals, documents, ...baseContact } = contact;
            // For now, just use the base contact without derived properties
            // Convert all null values to undefined per DATA_DOCTRINE
            const editableContact = {
              ...baseContact,
              phone: baseContact.phone ?? undefined,
              avatarUrl: baseContact.avatarUrl ?? undefined,
              lastContact: baseContact.lastContact ? baseContact.lastContact.toISOString() : undefined,
              status: baseContact.status ?? undefined,
              notes: baseContact.notes ?? undefined,
              lifecycleStage: baseContact.lifecycleStage ?? undefined,
              gdprConsentFormPath: baseContact.gdprConsentFormPath ?? undefined,
              profilePictureSource: baseContact.profilePictureSource ?? undefined,
              profilePictureScrapedAt: baseContact.profilePictureScrapedAt ? baseContact.profilePictureScrapedAt.toISOString() : undefined,
              sex: baseContact.sex ?? undefined,
              sentiment: baseContact.sentiment ?? undefined,
              referralCount: baseContact.referralCount ?? undefined,
              extractedFields: baseContact.extractedFields ? baseContact.extractedFields as Record<string, unknown> : undefined,
              revenueData: baseContact.revenueData ? baseContact.revenueData as Record<string, unknown> : undefined,
              engagementTrend: (baseContact.engagementTrend as 'improving' | 'stable' | 'declining' | undefined) ?? undefined,
              createdAt: baseContact.createdAt.toISOString(),
              updatedAt: baseContact.updatedAt.toISOString(),
            };
            setEditContact(editableContact);
          }}
        />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
        <div>
          <div className="flex items-center gap-3">
            <h1 className='text-3xl font-bold tracking-tight'>Contacts</h1>
            <Badge variant="secondary" className="text-sm">
              {allContacts.length}
            </Badge>
          </div>
          <p className='text-muted-foreground mt-1'>
            Manage your client relationships and interactions
          </p>
        </div>
      </div>


      {isLoading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {Array.from({ length: 6 }, (_, i) => (
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
      ) : allContacts.length === 0 ? (
        <Card className='text-center py-12'>
            <CardContent>
              <div className='text-muted-foreground mb-4'>
                You haven&apos;t added any contacts yet.
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
              contacts={allContacts}
              onSelectContact={setSelectedContactId}
              onEditContact={setEditContact}
              onDeleteContact={setDeleteContact}
              onBulkAction={handleBulkAction}
_onExportData={handleExportData}
              onAddContact={() => setShowAddDialog(true)}
              onAITool={handleAITool}
            />
          </TabsContent>
          <TabsContent value='cards'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {allContacts.map((contact: Contact) => (
                <Card
                  key={contact.id}
                  className='cursor-pointer hover:shadow-md transition-shadow'
                  onClick={() => setSelectedContactId(contact.id.toString())}
                >
                  <CardHeader className='flex flex-row items-center space-y-0 pb-2'>
                    <Avatar className='h-10 w-10'>
                      <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                    </Avatar>
                    <div className='ml-3 space-y-1 flex-1'>
                      <CardTitle className='text-sm font-medium'>{contact.name}</CardTitle>
                      <div className='flex items-center gap-2'>
                        <Badge variant='secondary' className={getStatusColor('active')}>
                          active
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditContact(contact);
                      }}
                    >
                      <Edit className="h-4 w-4 text-green-500" />
                    </Button>
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
                          {contact.lastContact && (
                            <div className='flex items-center gap-1'>
                              <MessageSquare className='h-3 w-3' />
                              <span>{new Date(contact.lastContact).toLocaleDateString()}</span>
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
      {photoUploadContact && (
        <ContactPhotoUpload
          contactId={photoUploadContact.id}
          contactName={photoUploadContact.name}
          currentPhotoUrl={photoUploadContact.avatarUrl ?? undefined}
          open={true}
          onOpenChange={(open) => !open && setPhotoUploadContact(null)}
        />
      )}

      {/* AI Photo Review Dialog */}
      {aiPhotoReviewContact && (
        <AIPhotoReview
          contact={aiPhotoReviewContact}
          open={true}
          onOpenChange={(open) => !open && setAiPhotoReviewContact(null)}
        />
      )}

      {/* Delete Contact Dialog */}
      <DeleteContactDialog
        contact={deleteContact}
        open={!!deleteContact}
        onOpenChange={(open) => !open && setDeleteContact(null)}
      />

      {/* Edit Contact Dialog */}
      <EditContactModal
        contact={editContact}
        open={!!editContact}
        onOpenChange={(open) => !open && setEditContact(null)}
      />

      {/* Tag Selection Dialog */}
      <TagSelectionDialog
        open={!!tagAction}
        onOpenChange={(open) => !open && setTagAction(null)}
onTagSelected={(tag) => {
          if (tagAction) {
            // Create a TagData object with the proper interface
            const tagData: TagData = {
              id: 'temp-id',
              name: tag.name,
              color: tag.color,
            };
            if (tagAction.type === 'add') {
              void handleBulkAddTag(tagData, tagAction.contactIds);
            } else {
              void handleBulkRemoveTag(tagData, tagAction.contactIds);
            }
            setTagAction(null);
          }
        }}
        title={tagAction?.type === 'add' ? 'Add Tag to Contacts' : 'Remove Tag from Contacts'}
        description={
          tagAction?.type === 'add'
            ? `Select a tag to add to ${tagAction?.contactIds.length ?? 0} selected contact(s).`
            : `Select a tag to remove from ${tagAction?.contactIds.length ?? 0} selected contact(s).`
        }
      />
    </div>
  );
}
