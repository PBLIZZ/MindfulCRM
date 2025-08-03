import type { DatabaseStorage } from '../storage.js';
import { llmProcessor } from './llm-processor.js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import type { Contact } from '../../shared/schema.js';

// Use Drizzle-inferred Contact type from schema following DATA_DOCTRINE
type ContactInfo = Pick<Contact, 'id' | 'name' | 'email' | 'phone'> & {
  company?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  allowProfilePictureScraping?: boolean | null;
};

interface PhotoSuggestion {
  id: string;
  url: string;
  source:
    | 'linkedin'
    | 'gravatar'
    | 'clearbit'
    | 'ai_generated'
    | 'facebook'
    | 'twitter'
    | 'instagram'
    | 'github';
  confidence: number;
  thumbnailUrl: string;
  metadata?: {
    size?: { width: number; height: number };
    format?: string;
    sourceUrl?: string;
    description?: string;
  };
}

interface SocialMediaHandles {
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  github?: string;
}

// API response interfaces to replace any types
interface ClearbitPersonResponse {
  avatar?: string;
  name?: string;
  email?: string;
}

interface GitHubUserResponse {
  avatar_url?: string;
  login?: string;
  name?: string;
}

export class PhotoEnrichmentService {
  constructor(private storage: DatabaseStorage) {}

  /**
   * Extract social media handles from contact information using LLM
   */
  async extractSocialMediaHandles(contact: ContactInfo): Promise<SocialMediaHandles> {
    const prompt = `
Analyze the following contact information and extract or suggest likely social media handles/URLs:

Contact: ${contact.name}
Email: ${contact.email ?? 'N/A'}
Company: ${contact.company ?? 'N/A'}
Job Title: ${contact.jobTitle ?? 'N/A'}
Phone: ${contact.phone ?? 'N/A'}
LinkedIn: ${contact.linkedinUrl ?? 'N/A'}

Based on this information, provide the most likely social media profiles in this JSON format:
{
  "linkedin": "https://linkedin.com/in/username or null",
  "facebook": "https://facebook.com/username or null", 
  "twitter": "https://twitter.com/username or null",
  "instagram": "https://instagram.com/username or null",
  "github": "https://github.com/username or null"
}

Only include URLs that you can reasonably infer from the provided information. Use null for platforms where you cannot make a reasonable guess.`;

    try {
      const response = await llmProcessor.processWithKimi(prompt);
      const handles = JSON.parse(response) as SocialMediaHandles;
      return handles;
    } catch (error) {
      console.error('Failed to extract social media handles:', error);
      return {};
    }
  }

  /**
   * Find photo suggestions for a contact using multiple sources
   */
  async findPhotoSuggestions(contact: ContactInfo): Promise<PhotoSuggestion[]> {
    const suggestions: PhotoSuggestion[] = [];

    try {
      // First, extract social media handles using LLM
      const socialHandles = await this.extractSocialMediaHandles(contact);

      // Try Gravatar first (most reliable for email-based lookup)
      if (contact.email) {
        const gravatarSuggestion = await this.getGravatarPhoto(contact.email);
        if (gravatarSuggestion) {
          suggestions.push(gravatarSuggestion);
        }
      }

      // Try Clearbit Person API
      if (contact.email) {
        const clearbitSuggestion = await this.getClearbitPhoto(contact.email);
        if (clearbitSuggestion) {
          suggestions.push(clearbitSuggestion);
        }
      }

      // Try GitHub if we found a handle
      if (socialHandles.github) {
        const githubSuggestion = await this.getGitHubPhoto(socialHandles.github);
        if (githubSuggestion) {
          suggestions.push(githubSuggestion);
        }
      }

      // Generate AI avatar as fallback
      if (suggestions.length === 0) {
        const aiSuggestion = this.generateAIAvatar(contact);
        suggestions.push(aiSuggestion);
      }

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Photo enrichment error:', error);
      return [];
    }
  }

  /**
   * Get Gravatar photo by email hash
   */
  private async getGravatarPhoto(email: string): Promise<PhotoSuggestion | null> {
    try {
      const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
      const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=200&d=404`;

      // Check if Gravatar exists
      const response = await fetch(gravatarUrl, { method: 'HEAD' });
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
            description: 'Gravatar profile photo',
          },
        };
      }
    } catch (error) {
      console.warn('Gravatar lookup failed:', error);
    }
    return null;
  }

  /**
   * Get Clearbit person photo by email
   */
  private async getClearbitPhoto(email: string): Promise<PhotoSuggestion | null> {
    try {
      const clearbitUrl = `https://person.clearbit.com/v1/people/email/${email}`;

      const response = await fetch(clearbitUrl);
      if (response.ok) {
        const data = (await response.json()) as ClearbitPersonResponse;
        if (data.avatar) {
          return {
            id: `clearbit_${email}`,
            url: data.avatar,
            source: 'clearbit',
            confidence: 0.7,
            thumbnailUrl: data.avatar,
            metadata: {
              format: 'jpeg',
              sourceUrl: clearbitUrl,
              description: 'Clearbit person profile photo',
            },
          };
        }
      }
    } catch (error) {
      console.warn('Clearbit lookup failed:', error);
    }
    return null;
  }

  /**
   * Get GitHub avatar from username
   */
  private async getGitHubPhoto(githubUrl: string): Promise<PhotoSuggestion | null> {
    try {
      const username = githubUrl.split('/').pop();
      if (!username) return null;

      const apiUrl = `https://api.github.com/users/${username}`;
      const response = await fetch(apiUrl);

      if (response.ok) {
        const data = (await response.json()) as GitHubUserResponse;
        if (data.avatar_url) {
          return {
            id: `github_${username}`,
            url: data.avatar_url,
            source: 'github',
            confidence: 0.6,
            thumbnailUrl: `${data.avatar_url}&s=50`,
            metadata: {
              format: 'jpeg',
              sourceUrl: githubUrl,
              description: `GitHub avatar for ${username}`,
            },
          };
        }
      }
    } catch (error) {
      console.warn('GitHub lookup failed:', error);
    }
    return null;
  }

  /**
   * Generate an AI avatar using the contact's name
   */
  private generateAIAvatar(contact: ContactInfo): PhotoSuggestion {
    const initials = contact.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

    // Generate using DiceBear (free avatar generation service)
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      contact.name
    )}&backgroundColor=random&fontSize=40`;

    return {
      id: `ai_generated_${Date.now()}`,
      url: avatarUrl,
      source: 'ai_generated',
      confidence: 0.5,
      thumbnailUrl: avatarUrl,
      metadata: {
        format: 'svg',
        description: `AI-generated avatar for ${contact.name} (${initials})`,
      },
    };
  }

  /**
   * Download and save a photo for a contact
   */
  async downloadAndSavePhoto(
    contactId: string,
    photoUrl: string,
    source: string
  ): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
    try {
      // Download the image
      const response = await fetch(photoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Generate filename
      const extension = photoUrl.includes('.png') ? 'png' : 'jpg';
      const filename = `${contactId}_${source}_${Date.now()}.${extension}`;
      const filepath = path.join(uploadsDir, filename);

      // Save the file
      await fs.writeFile(filepath, buffer);

      // Update contact with new avatar URL
      const avatarUrl = `/uploads/avatars/${filename}`;
      await this.storage.updateContact(contactId, { avatarUrl });

      return {
        success: true,
        avatarUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch process photo enrichment for all consented contacts
   */
  async batchEnrichPhotos(
    userId: string
  ): Promise<{ processed: number; success: number; errors: string[] }> {
    try {
      // Get user's GDPR consent status
      const user = await this.storage.getUserById(userId);
      if (!user?.allowProfilePictureScraping) {
        throw new Error('User has not consented to profile picture scraping');
      }

      // Get all contacts for this user that allow photo scraping
      const allContacts = await this.storage.getContactsByUserId(userId);
      const consentedContacts = allContacts.filter(
        (contact) => contact.hasGdprConsent && !contact.avatarUrl
      );

      const results = {
        processed: 0,
        success: 0,
        errors: [] as string[],
      };

      // Process contacts in batches to avoid rate limiting
      const batchSize = 3;
      for (let i = 0; i < consentedContacts.length; i += batchSize) {
        const batch = consentedContacts.slice(i, i + batchSize);

        for (const contact of batch) {
          try {
            results.processed++;
            const suggestions = await this.findPhotoSuggestions(contact);

            if (suggestions.length > 0) {
              const bestSuggestion = suggestions[0];
              const result = await this.downloadAndSavePhoto(
                contact.id,
                bestSuggestion.url,
                bestSuggestion.source
              );

              if (result.success) {
                results.success++;
                console.log(`✓ Enriched photo for ${contact.name} from ${bestSuggestion.source}`);
              } else {
                results.errors.push(`${contact.name}: ${result.error}`);
              }
            } else {
              results.errors.push(`${contact.name}: No photo suggestions found`);
            }
          } catch (error) {
            results.errors.push(
              `${contact.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }

        // Small delay between batches to respect rate limits
        if (i + batchSize < consentedContacts.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      return results;
    } catch (error) {
      throw new Error(
        `Batch enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enrich a single contact's photo
   */
  async enrichSingleContact(
    contactId: string
  ): Promise<{ success: boolean; suggestion?: PhotoSuggestion; error?: string }> {
    try {
      const contact = await this.storage.getContact(contactId);
      if (!contact) {
        throw new Error('Contact not found');
      }

      if (!contact.hasGdprConsent) {
        throw new Error('Contact has not consented to profile picture scraping');
      }

      const suggestions = await this.findPhotoSuggestions(contact);
      if (suggestions.length === 0) {
        throw new Error('No photo suggestions found');
      }

      const bestSuggestion = suggestions[0];
      const result = await this.downloadAndSavePhoto(
        contact.id,
        bestSuggestion.url,
        bestSuggestion.source
      );

      if (result.success) {
        return {
          success: true,
          suggestion: bestSuggestion,
        };
      } else {
        throw new Error(result.error ?? 'Failed to download photo');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
