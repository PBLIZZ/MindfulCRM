import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button.js'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog.js'
import { Card, CardContent } from '@/components/ui/card.js'
import { Badge } from '@/components/ui/badge.js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.js'
import { ScrollArea } from '@/components/ui/scroll-area.js'
import { 
  Loader2, 
  CheckCircle, 
  X, 
  ExternalLink, 
  Sparkles,
  User,
  Mail,
  Building
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast.js'
import { aiPhotoFinder, type ContactInfo, type PhotoSuggestion } from '@/services/aiPhotoFinder.js'
import type { Contact } from './ContactsTable.js'

interface AIPhotoReviewProps {
  contact: Contact | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'gravatar':
      return <Mail className="h-4 w-4" />
    case 'clearbit':
      return <Building className="h-4 w-4" />
    case 'linkedin':
      return <User className="h-4 w-4" />
    case 'ai_generated':
      return <Sparkles className="h-4 w-4" />
    default:
      return <User className="h-4 w-4" />
  }
}

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'gravatar':
      return 'Gravatar'
    case 'clearbit':
      return 'Clearbit'
    case 'linkedin':
      return 'LinkedIn'
    case 'ai_generated':
      return 'AI Generated'
    default:
      return source
  }
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800'
  if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
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

export function AIPhotoReview({
  contact,
  open,
  onOpenChange
}: AIPhotoReviewProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<PhotoSuggestion[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<PhotoSuggestion | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const downloadMutation = useMutation({
    mutationFn: async (suggestion: PhotoSuggestion) => {
      if (!contact) throw new Error('No contact selected')
      return aiPhotoFinder.downloadAndProcessPhoto(suggestion, contact.id)
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Photo updated successfully',
          description: 'Contact photo has been updated with AI suggestion.'
        })
        
        queryClient.invalidateQueries({ queryKey: ['/api/contacts'] })
        onOpenChange(false)
      } else {
        toast({
          title: 'Download failed',
          description: data.error,
          variant: 'destructive'
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Download failed',
        description: error.message ?? 'An unknown error occurred',
        variant: 'destructive'
      })
    }
  })

  const searchForPhotos = async () => {
    if (!contact) return
    
    setIsSearching(true)
    try {
      const contactInfo: ContactInfo = {
        name: contact.name,
        email: contact.email,
        company: contact.extractedFields?.company as string | undefined,
        linkedinUrl: contact.extractedFields?.linkedinUrl as string | undefined,
        jobTitle: contact.extractedFields?.jobTitle as string | undefined
      }

      const result = await aiPhotoFinder.findPhotoSuggestions(contactInfo)
      
      if (result.success) {
        setSuggestions(result.suggestions)
        if (result.suggestions.length === 0) {
          toast({
            title: 'No photos found',
            description: 'Could not find any photo suggestions for this contact.',
          })
        }
      } else {
        toast({
          title: 'Search failed',
          description: result.error,
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Search failed',
        description: 'Failed to search for photos.',
        variant: 'destructive'
      })
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (open && suggestions.length === 0 && contact) {
      searchForPhotos()
    }
  }, [ contact])

  const handleApplyPhoto = (suggestion: PhotoSuggestion) => {
    setSelectedSuggestion(suggestion)
    downloadMutation.mutate(suggestion)
  }

  const resetDialog = () => {
    setSuggestions([])
    setSelectedSuggestion(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog()
    }
    onOpenChange(newOpen)
  }

  if (!contact) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Photo Suggestions
          </DialogTitle>
          <DialogDescription>
            Found {suggestions.length} photo suggestions for {contact?.name || 'this contact'}. 
            Select a photo to apply to the contact.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Searching for photos...</p>
                <p className="text-xs text-muted-foreground">
                  Checking Gravatar, Clearbit, and other sources
                </p>
              </div>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No photo suggestions found for this contact.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={searchForPhotos}
              >
                Search Again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Current Photo */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2">Current Photo</h4>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                        <AvatarFallback className="text-lg">
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {contact.avatarUrl ? 'Has custom photo' : 'Using initials'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Photo Suggestions */}
              <div>
                <h4 className="text-sm font-medium mb-2">Photo Suggestions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {suggestions.map((suggestion) => (
                    <Card 
                      key={suggestion.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedSuggestion?.id === suggestion.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-12 w-12 flex-shrink-0">
                            <AvatarImage 
                              src={suggestion.thumbnailUrl || suggestion.url} 
                              alt={`${contact.name} - ${suggestion.source}`}
                            />
                            <AvatarFallback>
                              {getInitials(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {getSourceIcon(suggestion.source)}
                                <span className="ml-1">{getSourceLabel(suggestion.source)}</span>
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}
                              >
                                {Math.round(suggestion.confidence * 100)}% match
                              </Badge>
                            </div>
                            
                            {suggestion.metadata?.description && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {suggestion.metadata.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApplyPhoto(suggestion)}
                                disabled={downloadMutation.isPending}
                              >
                                {downloadMutation.isPending && selectedSuggestion?.id === suggestion.id ? (
                                  <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Applying...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Apply
                                  </>
                                )}
                              </Button>
                              
                              {suggestion.metadata?.sourceUrl && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(suggestion.metadata?.sourceUrl, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
            disabled={downloadMutation.isPending}
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          
          {suggestions.length > 0 && (
            <Button 
              variant="outline"
              onClick={searchForPhotos}
              disabled={isSearching || downloadMutation.isPending}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Search Again
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}