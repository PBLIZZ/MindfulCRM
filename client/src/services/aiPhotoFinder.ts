interface ContactInfo {
  name: string
  email?: string
  company?: string
  linkedinUrl?: string
  jobTitle?: string
}

interface PhotoSuggestion {
  id: string
  url: string
  source: 'linkedin' | 'gravatar' | 'clearbit' | 'ai_generated'
  confidence: number // 0-1 rating
  thumbnailUrl: string
  metadata?: {
    size?: { width: number; height: number }
    format?: string
    sourceUrl?: string
    description?: string
  }
}

interface ClearbitPersonResponse {
  avatar?: string
  name?: {
    fullName?: string
    givenName?: string
    familyName?: string
  }
  employment?: {
    name?: string
    title?: string
    domain?: string
  }
  [key: string]: unknown
}

interface PhotoDownloadResponse {
  avatarUrl?: string
  success?: boolean
  message?: string
  [key: string]: unknown
}

interface ErrorResponse {
  message?: string
  error?: string
  [key: string]: unknown
}

interface AIPhotoFinderResult {
  success: boolean
  suggestions: PhotoSuggestion[]
  error?: string
}

class AIPhotoFinderService {
  private apiKey?: string

  constructor() {
    this.apiKey = localStorage.getItem('openai_api_key') ?? undefined
  }

  /**
   * Find photo suggestions for a contact using multiple sources
   */
  async findPhotoSuggestions(contactInfo: ContactInfo): Promise<AIPhotoFinderResult> {
    try {
      const suggestions: PhotoSuggestion[] = []

      // Try Gravatar first (most reliable for email-based lookup)
      if (contactInfo.email) {
        const gravatarSuggestion = await this.getGravatarPhoto(contactInfo.email)
        if (gravatarSuggestion) {
          suggestions.push(gravatarSuggestion)
        }
      }

      // Try Clearbit Logo API for company-based lookup
      if (contactInfo.email) {
        const clearbitSuggestion = await this.getClearbitPhoto(contactInfo.email)
        if (clearbitSuggestion) {
          suggestions.push(clearbitSuggestion)
        }
      }

      // Try LinkedIn search (requires manual review)
      if (contactInfo.name) {
        const linkedinSuggestions = await this.searchLinkedInPhotos(contactInfo)
        suggestions.push(...linkedinSuggestions)
      }

      // Generate AI avatar if no photos found
      if (suggestions.length === 0) {
        const aiSuggestion = await this.generateAIAvatar(contactInfo)
        if (aiSuggestion) {
          suggestions.push(aiSuggestion)
        }
      }

      return {
        success: true,
        suggestions: suggestions.sort((a, b) => b.confidence - a.confidence)
      }
    } catch (error) {
      return {
        success: false,
        suggestions: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Get Gravatar photo by email hash
   */
  private async getGravatarPhoto(email: string): Promise<PhotoSuggestion | null> {
    try {
      const emailHash = await this.md5Hash(email.toLowerCase().trim())
      const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=200&d=404`
      
      // Check if Gravatar exists
      const response = await fetch(gravatarUrl, { method: 'HEAD' })
      if (response.ok) {
        return {
          id: `gravatar_${emailHash}`,
          url: gravatarUrl,
          source: 'gravatar',
          confidence: 0.8,
          thumbnailUrl: `https://www.gravatar.com/avatar/${emailHash}?s=50&d=404`,
          metadata: {
            size: { width: 200, height: 200 },
            format: 'jpeg',
            sourceUrl: `https://gravatar.com/profiles/${emailHash}`,
            description: 'Gravatar profile photo'
          }
        }
      }
    } catch {
    }
    return null
  }

  /**
   * Get Clearbit person photo by email
   */
  private async getClearbitPhoto(email: string): Promise<PhotoSuggestion | null> {
    try {
      const clearbitUrl = `https://person.clearbit.com/v1/people/email/${email}`
      
      // Note: This is a simplified version. In production, you'd need Clearbit API key
      const response = await fetch(clearbitUrl)
      if (response.ok) {
        const data = await response.json() as ClearbitPersonResponse
        if (data.avatar && typeof data.avatar === 'string') {
          return {
            id: `clearbit_${email}`,
            url: data.avatar,
            source: 'clearbit',
            confidence: 0.7,
            thumbnailUrl: data.avatar,
            metadata: {
              format: 'jpeg',
              sourceUrl: clearbitUrl,
              description: 'Clearbit person profile photo'
            }
          }
        }
      }
    } catch {
    }
    return null
  }

  /**
   * Search LinkedIn for potential profile photos
   * Note: This is a placeholder - actual LinkedIn API integration would require proper authentication
   */
  private async searchLinkedInPhotos(contactInfo: ContactInfo): Promise<PhotoSuggestion[]> {
    // This would integrate with LinkedIn API or a LinkedIn scraping service
    // For now, return empty array as this requires manual review anyway
    return []
  }

  /**
   * Generate an AI avatar using the contact's name and information
   */
  private async generateAIAvatar(contactInfo: ContactInfo): Promise<PhotoSuggestion | null> {
    if (!this.apiKey) {
      return null
    }

    try {
      // Use a service like DiceBear or generate a professional avatar
      const initials = contactInfo.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()

      // Generate using DiceBear (free avatar generation service)
      const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contactInfo.name)}&backgroundColor=random&fontSize=40`
      
      return {
        id: `ai_generated_${Date.now()}`,
        url: avatarUrl,
        source: 'ai_generated',
        confidence: 0.5,
        thumbnailUrl: avatarUrl,
        metadata: {
          format: 'svg',
          description: `AI-generated avatar for ${contactInfo.name} (${initials})`
        }
      }
    } catch {
    }
    return null
  }

  /**
   * Download and process a photo suggestion
   */
  async downloadAndProcessPhoto(suggestion: PhotoSuggestion, contactId: string): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
    try {
      const response = await fetch('/api/contacts/ai-photo-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          contactId,
          photoUrl: suggestion.url,
          source: suggestion.source,
          metadata: suggestion.metadata
        })
      })

      if (!response.ok) {
        const error = await response.json() as ErrorResponse
        const errorMessage = error.message || error.error || 'Download failed'
        throw new Error(typeof errorMessage === 'string' ? errorMessage : 'Download failed')
      }

      const result = await response.json() as PhotoDownloadResponse
      return {
        success: true,
        avatarUrl: typeof result.avatarUrl === 'string' ? result.avatarUrl : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      }
    }
  }

  /**
   * MD5 hash function for Gravatar
   */
  private async md5Hash(text: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(text)
    const hashBuffer = await crypto.subtle.digest('MD5', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Batch process photo suggestions for multiple contacts
   */
  async batchFindPhotos(contacts: ContactInfo[]): Promise<Map<string, AIPhotoFinderResult>> {
    const results = new Map<string, AIPhotoFinderResult>()
    
    // Process in batches to avoid rate limiting
    const batchSize = 5
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize)
      const batchPromises = batch.map(async (contact) => {
        const key = `${contact.name}_${contact.email}`
        const result = await this.findPhotoSuggestions(contact)
        results.set(key, result)
      })
      
      await Promise.all(batchPromises)
      
      // Small delay between batches
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }
}

export const aiPhotoFinder = new AIPhotoFinderService()
export type { ContactInfo, PhotoSuggestion, AIPhotoFinderResult }