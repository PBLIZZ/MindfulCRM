const API_BASE_URL = 'http://localhost:8080/api';

// TypeScript interfaces for API responses (CLIENT-SIDE: uses undefined per DATA_DOCTRINE)
export interface PhotoEnrichmentStats {
  totalContacts: number;
  enrichedContacts: number;
  pendingEnrichment: number;
  failedEnrichment: number;
  lastRunTime?: string; // undefined, not null
}

export interface UserProfile {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string; // undefined, not null
  allowProfilePictureScraping: boolean;
  gdprConsentDate?: string; // undefined, not null
  gdprConsentVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchEnrichmentResponse {
  jobId: string;
  message: string;
  contactIds: string[];
}

export interface ConsentUpdateResponse {
  success: boolean;
  message: string;
  allowProfilePictureScraping: boolean;
  gdprConsentDate: string;
}

export interface EnrichmentResponse {
  success: boolean;
  message: string;
  contactId: string;
  photoUrl?: string; // undefined, not null
}

export const fetchPhotoEnrichmentStats = async (): Promise<PhotoEnrichmentStats> => {
  const response = await fetch(`${API_BASE_URL}/photo-enrichment/stats`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch photo enrichment stats: ${response.status} ${errorText}`);
  }

  const data = await response.json() as PhotoEnrichmentStats;
  // Data should already be converted from null to undefined by server's sanitizeResponse
  return data;
};

export const fetchUserProfile = async (): Promise<UserProfile> => {
  const response = await fetch(`${API_BASE_URL}/profile`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch user profile: ${response.status} ${errorText}`);
  }

  const data = await response.json() as UserProfile;
  // Data should already be converted from null to undefined by server's sanitizeResponse
  return data;
};

export const startBatchEnrichment = async (contactIds: string[]): Promise<BatchEnrichmentResponse> => {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new Error('Contact IDs array is required and must not be empty');
  }

  const response = await fetch(`${API_BASE_URL}/photo-enrichment/batch`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contactIds }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start batch enrichment: ${response.status} ${errorText}`);
  }

  const data = await response.json() as BatchEnrichmentResponse;
  return data;
};

export const updateUserConsent = async (allowScraping: boolean): Promise<ConsentUpdateResponse> => {
  if (typeof allowScraping !== 'boolean') {
    throw new Error('allowScraping must be a boolean value');
  }

  const response = await fetch(`${API_BASE_URL}/profile/gdpr-consent`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      allowProfilePictureScraping: allowScraping,
      gdprConsentDate: new Date().toISOString(),
      gdprConsentVersion: '1.0'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update user consent: ${response.status} ${errorText}`);
  }

  const data = await response.json() as ConsentUpdateResponse;
  return data;
};

export const enrichSingleContact = async (contactId: string): Promise<EnrichmentResponse> => {
  if (!contactId || typeof contactId !== 'string') {
    throw new Error('contactId is required and must be a string');
  }

  const response = await fetch(`${API_BASE_URL}/contacts/${encodeURIComponent(contactId)}/enrich-photo`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to enrich single contact: ${response.status} ${errorText}`);
  }

  const data = await response.json() as EnrichmentResponse;
  return data;
};
