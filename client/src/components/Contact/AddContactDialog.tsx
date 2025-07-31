import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'potential']),
  lifecycleStage: z.enum(['discovery', 'curious', 'new_client', 'core_client', 'ambassador', 'needs_reconnecting', 'inactive', 'collaborator']).optional(),
  sentiment: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  healthGoals: z.string().optional(),
  emergencyContact: z.string().optional(),
  preferredContactMethod: z.enum(['email', 'phone', 'text']).optional(),
  // Dynamic fields that will be stored in extractedFields
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  address: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      status: 'potential',
      lifecycleStage: undefined,
      sentiment: undefined,
      notes: '',
      healthGoals: '',
      emergencyContact: '',
      preferredContactMethod: 'email',
      company: '',
      jobTitle: '',
      website: '',
      linkedinUrl: '',
      address: '',
    },
  });

  const createContact = useMutation({
    mutationFn: (data: ContactFormData) =>
      apiRequest('POST', '/api/contacts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Contact added',
        description: 'The contact has been successfully added to your list.',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add contact. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    // Separate standard fields from extracted fields
    const { company, jobTitle, website, linkedinUrl, address, ...standardFields } = data;
    
    // Build extracted fields object
    const extractedFields: Record<string, any> = {};
    if (company) extractedFields.company = company;
    if (jobTitle) extractedFields.jobTitle = jobTitle;
    if (website) extractedFields.website = website;
    if (linkedinUrl) extractedFields.linkedinUrl = linkedinUrl;
    if (address) extractedFields.address = address;
    
    // Clean up empty strings from standard fields
    const cleanData = Object.fromEntries(
      Object.entries(standardFields).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
    );
    
    // Add extracted fields if not empty
    if (Object.keys(extractedFields).length > 0) {
      (cleanData as any).extractedFields = extractedFields;
    }
    
    createContact.mutate(cleanData as ContactFormData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>
            Add a new client or contact to your CRM. Fill in as much information as you
            have available. Additional fields will be stored for future reference.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter full name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='potential'>Potential Client</SelectItem>
                        <SelectItem value='active'>Active Client</SelectItem>
                        <SelectItem value='inactive'>Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type='email' placeholder='Enter email address' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter phone number' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='lifecycleStage'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lifecycle Stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Will be set by LLM analysis' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='discovery'>Discovery</SelectItem>
                        <SelectItem value='curious'>Curious</SelectItem>
                        <SelectItem value='new_client'>New Client</SelectItem>
                        <SelectItem value='core_client'>Core Client</SelectItem>
                        <SelectItem value='ambassador'>Ambassador</SelectItem>
                        <SelectItem value='needs_reconnecting'>Needs Reconnecting</SelectItem>
                        <SelectItem value='inactive'>Inactive</SelectItem>
                        <SelectItem value='collaborator'>Collaborator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='sentiment'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sentiment Rating</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value ? String(field.value) : undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Will be analyzed by LLM' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='1'>1 - Very Negative</SelectItem>
                        <SelectItem value='2'>2 - Negative</SelectItem>
                        <SelectItem value='3'>3 - Neutral</SelectItem>
                        <SelectItem value='4'>4 - Positive</SelectItem>
                        <SelectItem value='5'>5 - Very Positive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='preferredContactMethod'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Contact Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select preferred method' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='email'>Email</SelectItem>
                      <SelectItem value='phone'>Phone Call</SelectItem>
                      <SelectItem value='text'>Text Message</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Professional Information */}
            <div className='space-y-4'>
              <h4 className='text-sm font-medium text-muted-foreground'>Professional Information</h4>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='company'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder='Company name' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='jobTitle'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder='Job title or position' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='website'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder='https://example.com' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='linkedinUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn URL</FormLabel>
                      <FormControl>
                        <Input placeholder='https://linkedin.com/in/username' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='address'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Full address...'
                        className='min-h-[60px]'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='healthGoals'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Health & Wellness Goals</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Describe their wellness goals and objectives...'
                      className='min-h-[80px]'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Any additional notes about this contact...'
                      className='min-h-[80px]'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='emergencyContact'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl>
                    <Input placeholder='Emergency contact name and phone' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={createContact.isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={createContact.isPending}>
                {createContact.isPending ? 'Adding...' : 'Add Contact'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
