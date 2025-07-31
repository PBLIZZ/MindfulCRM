import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ContactPhotoUploadProps {
  contactId: string
  contactName: string
  currentPhotoUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface UploadResponse {
  success: boolean
  avatarUrl?: string
  error?: string
}

const MAX_FILE_SIZE = 250 * 1024 // 250KB
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

const getInitials = (name: string) => {
  return (
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  )
}

const convertToWebP = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // Calculate dimensions to maintain aspect ratio within max bounds
      const maxSize = 200
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
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to convert image'))
          }
        },
        'image/webp',
        0.8 // Quality setting
      )
    }
    
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export function ContactPhotoUpload({
  contactId,
  contactName,
  currentPhotoUrl,
  open,
  onOpenChange
}: ContactPhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadResponse> => {
      const formData = new FormData()
      
      // Convert to WebP if not already
      let processedFile: File | Blob = file
      if (file.type !== 'image/webp') {
        processedFile = await convertToWebP(file)
      }
      
      // Check file size after conversion
      if (processedFile.size > MAX_FILE_SIZE) {
        throw new Error(`File size must be under 250KB. Current size: ${Math.round(processedFile.size / 1024)}KB`)
      }
      
      formData.append('photo', processedFile, `${contactId}.webp`)
      formData.append('contactId', contactId)
      
      const response = await fetch('/api/contacts/upload-photo', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Upload failed')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Photo uploaded successfully',
          description: 'Contact photo has been updated.'
        })
        
        // Invalidate contacts query to refresh the data
        queryClient.invalidateQueries({ queryKey: ['/api/contacts'] })
        
        // Close dialog and reset state
        onOpenChange(false)
        setPreview(null)
        setSelectedFile(null)
        setUploadProgress(0)
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      })
      setUploadProgress(0)
    }
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPEG, PNG, or WebP image.',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (before conversion)
    if (file.size > MAX_FILE_SIZE * 2) { // Allow 2x for conversion
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 500KB.',
        variant: 'destructive'
      })
      return
    }

    setSelectedFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = () => {
    if (!selectedFile) return
    uploadMutation.mutate(selectedFile)
  }

  const handleRemovePhoto = async () => {
    try {
      const response = await fetch(`/api/contacts/${contactId}/photo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        toast({
          title: 'Photo removed',
          description: 'Contact photo has been removed.'
        })
        
        queryClient.invalidateQueries({ queryKey: ['/api/contacts'] })
        onOpenChange(false)
      }
    } catch (error) {
      toast({
        title: 'Failed to remove photo',
        description: 'Please try again.',
        variant: 'destructive'
      })
    }
  }

  const resetDialog = () => {
    setPreview(null)
    setSelectedFile(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Contact Photo</DialogTitle>
          <DialogDescription>
            Upload a new photo for {contactName}. Images will be optimized to WebP format and resized to 200x200px.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current/Preview Photo */}
          <div className="flex justify-center">
            <Avatar className="h-24 w-24">
              <AvatarImage 
                src={preview || currentPhotoUrl} 
                alt={contactName} 
              />
              <AvatarFallback className="text-2xl">
                {getInitials(contactName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Choose Photo
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Max file size: 250KB • Formats: JPEG, PNG, WebP
            </p>
          </div>

          {/* Upload Progress */}
          {uploadMutation.isPending && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                Uploading and optimizing...
              </p>
            </div>
          )}

          {/* File Info */}
          {selectedFile && !uploadMutation.isPending && (
            <div className="bg-muted p-3 rounded-md">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(selectedFile.size / 1024)}KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetDialog}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentPhotoUrl && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemovePhoto}
              className="sm:mr-auto"
            >
              Remove Photo
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photo
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}