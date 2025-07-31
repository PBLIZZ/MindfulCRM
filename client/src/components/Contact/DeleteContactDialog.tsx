import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { 
  Trash2, 
  AlertTriangle, 
  FileText, 
  MessageSquare, 
  Calendar,
  Target,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Contact } from './ContactsTable'

interface DeleteContactDialogProps {
  contact: Contact | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface CascadeInfo {
  interactions: number
  goals: number
  documents: number
  calendarEvents: number
  voiceNotes: number
  photos: number
}

const getInitials = (name: string) => {
  return (
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  )
}

export function DeleteContactDialog({
  contact,
  open,
  onOpenChange
}: DeleteContactDialogProps) {
  const [cascadeInfo, setCascadeInfo] = useState<CascadeInfo | null>(null)
  const [isLoadingCascade, setIsLoadingCascade] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete contact')
      }

      return response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Contact deleted',
        description: 'The contact and all associated data have been permanently deleted.',
      })
      
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] })
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] })
      
      onOpenChange(false)
      setCascadeInfo(null)
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete contact',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const loadCascadeInfo = async (contactId: string) => {
    setIsLoadingCascade(true)
    try {
      const response = await fetch(`/api/contacts/${contactId}/cascade-info`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCascadeInfo(data)
      } else {
        // If endpoint doesn't exist, show default info
        setCascadeInfo({
          interactions: 0,
          goals: 0,
          documents: 0,
          calendarEvents: 0,
          voiceNotes: 0,
          photos: 0
        })
      }
    } catch (error) {
      console.warn('Failed to load cascade info:', error)
      setCascadeInfo({
        interactions: 0,
        goals: 0,
        documents: 0,
        calendarEvents: 0,
        voiceNotes: 0,
        photos: 0
      })
    } finally {
      setIsLoadingCascade(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && contact && !cascadeInfo) {
      loadCascadeInfo(contact.id)
    } else if (!newOpen) {
      setCascadeInfo(null)
    }
    onOpenChange(newOpen)
  }

  const handleDelete = () => {
    if (contact) {
      deleteMutation.mutate(contact.id)
    }
  }

  if (!contact) return null

  const totalRelatedItems = cascadeInfo 
    ? Object.values(cascadeInfo).reduce((sum, count) => sum + count, 0)
    : 0

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Contact
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the contact
            and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Contact Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                  <AvatarFallback>
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="font-semibold">{contact.name}</h4>
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {contact.status}
                    </Badge>
                    {contact.lifecycleStage && (
                      <Badge variant="outline" className="text-xs">
                        {contact.lifecycleStage.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cascade Information */}
          {isLoadingCascade ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Checking related data...
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : cascadeInfo && totalRelatedItems > 0 ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-destructive mb-2">
                      Warning: Related Data Will Be Deleted
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      This contact has {totalRelatedItems} related item{totalRelatedItems !== 1 ? 's' : ''} that will also be permanently deleted:
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {cascadeInfo.interactions > 0 && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span>{cascadeInfo.interactions} interaction{cascadeInfo.interactions !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {cascadeInfo.calendarEvents > 0 && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{cascadeInfo.calendarEvents} calendar event{cascadeInfo.calendarEvents !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {cascadeInfo.goals > 0 && (
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span>{cascadeInfo.goals} goal{cascadeInfo.goals !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {cascadeInfo.documents > 0 && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{cascadeInfo.documents} document{cascadeInfo.documents !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {cascadeInfo.voiceNotes > 0 && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span>{cascadeInfo.voiceNotes} voice note{cascadeInfo.voiceNotes !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {cascadeInfo.photos > 0 && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{cascadeInfo.photos} photo{cascadeInfo.photos !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : cascadeInfo && totalRelatedItems === 0 ? (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      No related data found
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      This contact can be safely deleted without affecting other records.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Separator />

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Contact information and profile</li>
              <li>All interaction history</li>
              <li>Goals and progress tracking</li>
              <li>Uploaded documents and photos</li>
              <li>Calendar events and meeting notes</li>
              <li>All associated metadata</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Contact
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}