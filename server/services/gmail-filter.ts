import { gmail_v1, google } from 'googleapis';

export interface EmailFilterConfig {
  // Category exclusions (Gmail's automatic categorization)
  excludeCategories: string[];
  // Date range filtering
  afterDate?: Date;
  beforeDate?: Date;
  // Business domain filtering
  includeDomains?: string[];
  excludeDomains?: string[];
  // Content-based filtering
  businessKeywords: string[];
  spamKeywords: string[];
  // Relevance scoring thresholds
  minRelevanceScore: number;
}

export interface FilteredEmail {
  message: gmail_v1.Schema$Message;
  relevanceScore: number;
  filterReason: string;
  category?: string;
}

export class GmailFilterService {
  private gmail: gmail_v1.Gmail;
  private config: EmailFilterConfig;

  constructor(auth: any, config?: Partial<EmailFilterConfig>) {
    this.gmail = google.gmail({ version: 'v1', auth });
    this.config = {
      excludeCategories: ['promotions', 'social', 'updates', 'forums'],
      businessKeywords: [
        'meeting', 'proposal', 'contract', 'invoice', 'quote', 'project',
        'deadline', 'schedule', 'budget', 'client', 'appointment', 'call',
        'consultation', 'review', 'feedback', 'collaboration', 'partnership'
      ],
      spamKeywords: [
        'unsubscribe', 'opt out', 'click here', 'free trial', 'limited time',
        'act now', 'congratulations', 'winner', 'prize', 'lottery', 'urgent',
        'expires today', 'special offer', 'discount', 'sale ends'
      ],
      minRelevanceScore: 6,
      ...config
    };
  }

  /**
   * Build Gmail API query with aggressive pre-filtering
   */
  private buildFilterQuery(options: {
    afterDate?: Date;
    beforeDate?: Date;
    maxResults?: number;
  } = {}): string {
    const queryParts: string[] = [];

    // Exclude non-business categories (most effective filter)
    this.config.excludeCategories.forEach(category => {
      queryParts.push(`-category:${category}`);
    });

    // Date filtering
    if (options.afterDate) {
      const dateStr = options.afterDate.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`after:${dateStr}`);
    }
    if (options.beforeDate) {
      const dateStr = options.beforeDate.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`before:${dateStr}`);
    }

    // Exclude obvious spam patterns
    const spamExclusions = [
      '-"unsubscribe"',
      '-"opt out"', 
      '-"click here"',
      '-"free trial"',
      '-"limited time"'
    ];
    queryParts.push(...spamExclusions);

    // Include business indicators (OR query)
    const businessIndicators = [
      'has:attachment',
      '"meeting"',
      '"proposal"',
      '"contract"',
      '"invoice"',
      '"project"',
      '"client"'
    ];
    if (businessIndicators.length > 0) {
      queryParts.push(`(${businessIndicators.join(' OR ')})`);
    }

    return queryParts.join(' ');
  }

  /**
   * Calculate business relevance score for an email
   */
  private calculateRelevanceScore(
    subject: string = '',
    fromEmail: string = '',
    snippet: string = '',
    hasAttachments: boolean = false,
    category?: string
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Category-based scoring
    if (category === 'primary') {
      score += 3;
      reasons.push('Gmail primary category');
    } else if (this.config.excludeCategories.includes(category || '')) {
      score -= 5;
      reasons.push(`Excluded category: ${category}`);
    }

    // Business keywords in subject (weighted heavily)
    const subjectLower = subject.toLowerCase();
    const businessMatches = this.config.businessKeywords.filter(keyword => 
      subjectLower.includes(keyword.toLowerCase())
    );
    if (businessMatches.length > 0) {
      score += businessMatches.length * 2;
      reasons.push(`Business keywords in subject: ${businessMatches.join(', ')}`);
    }

    // Spam keywords (heavy penalty)
    const spamMatches = this.config.spamKeywords.filter(keyword =>
      subjectLower.includes(keyword.toLowerCase()) || 
      snippet.toLowerCase().includes(keyword.toLowerCase())
    );
    if (spamMatches.length > 0) {
      score -= spamMatches.length * 3;
      reasons.push(`Spam indicators: ${spamMatches.join(', ')}`);
    }

    // Domain analysis
    const domain = fromEmail.split('@')[1]?.toLowerCase();
    if (domain) {
      // Business domains
      if (this.config.includeDomains?.includes(domain)) {
        score += 4;
        reasons.push(`Whitelisted domain: ${domain}`);
      }
      
      // Exclude known marketing domains
      const marketingDomains = [
        'mailchimp.com', 'constantcontact.com', 'campaign-archive.com',
        'mailjet.com', 'sendgrid.net', 'amazonses.com', 'notifications.google.com',
        'noreply', 'no-reply', 'donotreply'
      ];
      
      if (marketingDomains.some(md => domain.includes(md)) || 
          fromEmail.toLowerCase().includes('noreply')) {
        score -= 4;
        reasons.push(`Marketing/automated domain: ${domain}`);
      }

      // Personal email domains (lower priority)
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      if (personalDomains.includes(domain)) {
        score -= 1;
        reasons.push(`Personal email domain: ${domain}`);
      }
    }

    // Attachments indicate business correspondence
    if (hasAttachments) {
      score += 2;
      reasons.push('Has attachments');
    }

    // Content analysis
    const businessContentKeywords = [
      'meeting', 'schedule', 'appointment', 'call', 'zoom', 'teams',
      'proposal', 'contract', 'agreement', 'invoice', 'payment',
      'project', 'deadline', 'milestone', 'deliverable',
      'client', 'customer', 'collaboration', 'partnership'
    ];

    const contentText = (subject + ' ' + snippet).toLowerCase();
    const contentMatches = businessContentKeywords.filter(keyword =>
      contentText.includes(keyword)
    );

    if (contentMatches.length > 0) {
      score += Math.min(contentMatches.length, 3); // Cap at +3
      reasons.push(`Business content indicators: ${contentMatches.slice(0, 3).join(', ')}`);
    }

    return { score: Math.max(0, Math.min(10, score)), reasons };
  }

  /**
   * Fetch and filter emails with aggressive pre-filtering
   */
  async fetchFilteredEmails(options: {
    afterDate?: Date;
    beforeDate?: Date;
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<{
    emails: FilteredEmail[];
    totalFetched: number;
    totalFiltered: number;
    nextPageToken?: string;
  }> {
    const query = this.buildFilterQuery(options);
    
    console.log('Gmail API Query:', query);

    try {
      // First, get message list with pre-filtering
      const listResponse = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: options.maxResults || 100,
        pageToken: options.pageToken
      });

      const messages = listResponse.data.messages || [];
      const totalFetched = messages.length;

      if (messages.length === 0) {
        return { 
          emails: [], 
          totalFetched: 0, 
          totalFiltered: 0,
          nextPageToken: listResponse.data.nextPageToken 
        };
      }

      // Batch fetch message details (up to 100 at a time)
      const batchSize = 100;
      const filteredEmails: FilteredEmail[] = [];

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        // Create batch request
        const batchPromises = batch.map(message => 
          this.gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'To', 'Date', 'Category']
          })
        );

        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            const message = result.value.data;
            const headers = message.payload?.headers || [];
            
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const fromEmail = from.match(/<(.+?)>/)?.[1] || from;
            
            // Extract category if available
            const category = headers.find(h => h.name === 'Category')?.value;
            
            const hasAttachments = (message.payload?.parts?.some(part => 
              part.filename && part.filename.length > 0
            )) || false;

            // Calculate relevance score
            const { score, reasons } = this.calculateRelevanceScore(
              subject,
              fromEmail,
              message.snippet || '',
              hasAttachments,
              category
            );

            // Only include emails above threshold
            if (score >= this.config.minRelevanceScore) {
              filteredEmails.push({
                message,
                relevanceScore: score,
                filterReason: reasons.join('; '),
                category
              });
            }
          }
        }
      }

      // Sort by relevance score (highest first)
      filteredEmails.sort((a, b) => b.relevanceScore - a.relevanceScore);

      return {
        emails: filteredEmails,
        totalFetched,
        totalFiltered: filteredEmails.length,
        nextPageToken: listResponse.data.nextPageToken
      };

    } catch (error) {
      console.error('Gmail filtering error:', error);
      throw new Error(`Failed to fetch filtered emails: ${error}`);
    }
  }

  /**
   * Get filtering statistics for monitoring
   */
  async getFilteringStats(days: number = 7): Promise<{
    totalEmails: number;
    excludedByCategory: Record<string, number>;
    averageRelevanceScore: number;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days);

    // Get total emails without filtering
    const totalQuery = `after:${afterDate.toISOString().split('T')[0].replace(/-/g, '/')}`;
    const totalResponse = await this.gmail.users.messages.list({
      userId: 'me',
      q: totalQuery,
      maxResults: 1
    });

    // Get filtered results
    const filteredResult = await this.fetchFilteredEmails({ 
      afterDate, 
      maxResults: 100 
    });

    const processingTimeMs = Date.now() - startTime;

    return {
      totalEmails: totalResponse.data.resultSizeEstimate || 0,
      excludedByCategory: {}, // Would need additional API calls to get category breakdown
      averageRelevanceScore: filteredResult.emails.length > 0 
        ? filteredResult.emails.reduce((sum, email) => sum + email.relevanceScore, 0) / filteredResult.emails.length
        : 0,
      processingTimeMs
    };
  }

  /**
   * Update filter configuration
   */
  updateConfig(newConfig: Partial<EmailFilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export default GmailFilterService;