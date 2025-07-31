import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter, Mail, Phone, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AddContactDialog from '@/components/Contact/AddContactDialog';
import ContactDetail from '@/components/Contact/ContactDetail';

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['/api/contacts'],
  }) as { data: any[]; isLoading: boolean };

  const filteredContacts =
    contacts?.filter((contact: any) => {
      const matchesSearch =
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || contact.status === filterStatus;
      return matchesSearch && matchesFilter;
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
        <Button onClick={() => setShowAddDialog(true)} className='flex items-center gap-2'>
          <Plus className='h-4 w-4' />
          Add Contact
        </Button>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' className='flex items-center gap-2'>
                <Filter className='h-4 w-4' />
                Filter: {filterStatus === 'all' ? 'All' : filterStatus}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus('all')}>
                All Contacts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('active')}>Active</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('inactive')}>
                Inactive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('potential')}>
                Potential
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                {searchTerm || filterStatus !== 'all' ? (
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
      )}

      <AddContactDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
}
