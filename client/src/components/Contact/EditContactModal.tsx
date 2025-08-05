import { useState, useRef, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button.js'
import { Input } from '@/components/ui/input.js'
import { Label } from '@/components/ui/label.js'
import { Textarea } from '@/components/ui/textarea.js'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js'
import { Badge } from '@/components/ui/badge.js'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.js'
import { 
  Upload, 
  X, 
   
  Loader2,
  Plus
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast.js'
import type { Contact } from './ContactsTable.js'

interface ImageUploadResponse {
  success: boolean
  avatarUrl: string
  error?: string
}

interface ContactUpdateResponse {
  success: boolean
  contact: Contact
  error?: string
}

interface EditContactModalProps {
  contact: Contact | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ContactUpdateData {
  name: string
  email?: string
  phone?: string
  notes?: string
  lifecycleStage?: Contact['lifecycleStage']
  tags?: Array<{id: string, name: string, color: string}>
}

// Image processing utilities
const convertToWebP = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // Calculate dimensions to maintain aspect ratio
      const maxSize = 400
      let { width, height } = img
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and convert to WebP
      ctx?.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size <= 250 * 1024) { // 250KB limit
            const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
              type: 'image/webp'
            })
            resolve(webpFile)
          } else if (blob) {
            // If still too large, reduce quality
            canvas.toBlob(
              (smallerBlob) => {
                if (smallerBlob) {
                  const webpFile = new File([smallerBlob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                    type: 'image/webp'
                  })
                  resolve(webpFile)
                } else {
                  reject(new Error('Failed to compress image'))
                }
              },
              'image/webp',
              0.7
            )
          } else {
            reject(new Error('Failed to convert image'))
          }
        },
        'image/webp',
        0.9
      )
    }
    
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

const getInitials = (name: string) => {
  return name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || '?'
}

export function EditContactModal({ contact, open, onOpenChange }: EditContactModalProps) {
  const [formData, setFormData] = useState<ContactUpdateData>({
    name: '',
    email: '',
    phone: '',
    notes: '',
    lifecycleStage: 'discovery',
    tags: []
  })
  
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Initialize form data when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        notes: contact.notes ?? '',
        lifecycleStage: contact.lifecycleStage ?? 'discovery',
        tags: contact.tags ?? []
      })
      setImagePreview(contact.avatarUrl ?? '')
      setImageFile(null)
    }
  }, [contact])

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactUpdateData & { imageFile?: File }): Promise<ContactUpdateResponse> => {
      if (!contact) throw new Error('No contact selected')
      
      let avatarUrl = contact.avatarUrl
      
      // Upload image if provided
      if (data.imageFile) {
        const formData = new FormData()
        formData.append('image', data.imageFile)
        formData.append('contactId', contact.id)
        
        const imageResponse = await fetch('/api/contacts/upload-photo', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        })
        
        if (!imageResponse.ok) {
          throw new Error('Failed to upload image')
        }
        
        const imageResult = await imageResponse.json() as ImageUploadResponse
        avatarUrl = imageResult.avatarUrl
      }
      
      // Update contact data
      const updateData = { ...data, avatarUrl }
      delete updateData.imageFile
      
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updateData),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update contact')
      }
      
      return await response.json() as ContactUpdateResponse
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/contacts'] })
      toast({
        title: 'Contact updated',
        description: 'Contact has been successfully updated.',
      })
      onOpenChange(false)
      resetForm()
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update contact',
        variant: 'destructive',
      })
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      notes: '',
      lifecycleStage: 'discovery',
      tags: []
    })
    setImageFile(null)
    setImagePreview('')
    setNewTagName('')
  }

  const handleImageSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive'
      })
      return
    }

    setUploadingImage(true)
    
    try {
      const webpFile = await convertToWebP(file)
      setImageFile(webpFile)
      setImagePreview(URL.createObjectURL(webpFile))
      
      toast({
        title: 'Image processed',
        description: `Image converted to WebP format (${Math.round(webpFile.size / 1024)}KB)`,
      })
    } catch {
      toast({
        title: 'Image processing failed',
        description: 'Failed to process the image. Please try another file.',
        variant: 'destructive'
      })
    } finally {
      setUploadingImage(false)
    }
  }, [toast])

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleImageSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      void handleImageSelect(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const addTag = () => {
    if (!newTagName.trim()) return
    
    const newTag = {
      id: `temp_${Date.now()}`,
      name: newTagName.trim(),
      color: '#3b82f6' // Default blue color
    }
    
    setFormData(prev => ({
      ...prev,
      tags: [...(prev.tags ?? []), newTag]
    }))
    setNewTagName('')
  }

  const removeTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag.id !== tagId) ?? []
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a contact name.',
        variant: 'destructive'
      })
      return
    }
    
    updateContactMutation.mutate({
      ...formData,
                  imageFile: imageFile ?? undefined
    })
  }

  if (!contact) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload Section */}
          <div className="space-y-4">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={imagePreview} alt={formData.name} />
                <AvatarFallback className="text-lg">
                  {getInitials(formData.name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingImage ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Processing image...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <div className="text-sm">
                        <span className="font-medium">Click to upload</span> or drag and drop
                      </div>
                      <div className="text-xs text-muted-foreground">
                        PNG, JPG, GIF up to 10MB (will be converted to WebP and optimized)
                      </div>
                    </div>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
                
                {(imagePreview || imageFile) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeImage}
                    className="mt-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove Image
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Contact name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="contact@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lifecycleStage">Lifecycle Stage</Label>
              <Select
                value={formData.lifecycleStage}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  lifecycleStage: value as Contact['lifecycleStage']
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lifecycle stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="curious">Curious</SelectItem>
                  <SelectItem value="new_client">New Client</SelectItem>
                  <SelectItem value="core_client">Core Client</SelectItem>
                  <SelectItem value="ambassador">Ambassador</SelectItem>
                  <SelectItem value="needs_reconnecting">Needs Reconnecting</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="collaborator">Collaborator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                  style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => removeTag(tag.id)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Add a tag..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add notes about this contact..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateContactMutation.isPending || uploadingImage}
            >
              {updateContactMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Contact'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}