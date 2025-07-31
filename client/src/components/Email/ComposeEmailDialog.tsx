import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Paperclip, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const emailSchema = z.object({
  to: z.string().min(1, 'Recipient is required'),
  cc: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Message body is required'),
  contactId: z.string().optional(),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Array<{ id: string; name: string; email: string }>;
  replyTo?: {
    subject: string;
    to: string;
    body: string;
  };
}

export default function ComposeEmailDialog({
  open,
  onOpenChange,
  contacts = [],
  replyTo,
}: ComposeEmailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      to: replyTo?.to || '',
      cc: '',
      subject: replyTo?.subject ? `Re: ${replyTo.subject}` : '',
      body: replyTo?.body ? `\n\n--- Original Message ---\n${replyTo.body}` : '',
      contactId: '',
    },
  });

  const sendEmail = useMutation({
    mutationFn: (data: EmailFormData) =>
      apiRequest('POST', '/api/emails/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      toast({
        title: 'Email sent',
        description: 'Your email has been sent successfully.',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send email',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EmailFormData) => {
    sendEmail.mutate(data);
  };

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      form.setValue('to', contact.email);
      form.setValue('contactId', contactId);
    }
  };

  const getEmailTemplates = () => [
    {
      name: 'Welcome Message',
      subject: 'Welcome to your wellness journey!',
      body: "Dear [Client Name],\n\nWelcome to our wellness program! I'm excited to work with you on achieving your health goals.\n\nBest regards,\n[Your Name]",
    },
    {
      name: 'Session Reminder',
      subject: 'Upcoming Session Reminder',
      body: 'Hi [Client Name],\n\nThis is a friendly reminder about your upcoming session scheduled for [Date/Time].\n\nLooking forward to seeing you!\n\nBest,\n[Your Name]',
    },
    {
      name: 'Follow-up',
      subject: 'Following up on our last session',
      body: "Hi [Client Name],\n\nI hope you're doing well! I wanted to follow up on our last session and see how you're progressing with your goals.\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[700px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>Send an email to your clients or contacts.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='contactId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Contact (Optional)</FormLabel>
                    <Select onValueChange={handleContactSelect} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Choose a contact' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value=''>
                          <span className='text-muted-foreground'>No contact selected</span>
                        </SelectItem>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            <div className='flex items-center gap-2'>
                              <div className='h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs'>
                                {contact.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </div>
                              <div>
                                <div className='font-medium'>{contact.name}</div>
                                <div className='text-sm text-muted-foreground'>{contact.email}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Email Templates</label>
                <Select
                  onValueChange={(templateName) => {
                    const template = getEmailTemplates().find((t) => t.name === templateName);
                    if (template) {
                      form.setValue('subject', template.subject);
                      form.setValue('body', template.body);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Choose a template' />
                  </SelectTrigger>
                  <SelectContent>
                    {getEmailTemplates().map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <FormField
              control={form.control}
              name='to'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To *</FormLabel>
                  <FormControl>
                    <Input placeholder='recipient@example.com' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='cc'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CC</FormLabel>
                  <FormControl>
                    <Input placeholder='cc@example.com' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='subject'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input placeholder='Email subject' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='body'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Type your message here...'
                      className='min-h-[200px]'
                      {...field}
                    />
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
                disabled={sendEmail.isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={sendEmail.isPending}>
                <Send className='h-4 w-4 mr-2' />
                {sendEmail.isPending ? 'Sending...' : 'Send Email'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
