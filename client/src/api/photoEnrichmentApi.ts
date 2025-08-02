const API_BASE_URL = 'http://localhost:8080/api';

export const fetchPhotoEnrichmentStats = async () => {
  const response = await fetch(`${API_BASE_URL}/photo-enrichment/stats`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch photo enrichment stats');
  }

  return response.json();
};

export const fetchUserProfile = async () => {
  const response = await fetch(`${API_BASE_URL}/profile`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return response.json();
};

export const startBatchEnrichment = async (contactIds: string[]) => {
  const response = await fetch(`${API_BASE_URL}/photo-enrichment/batch`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contactIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to start batch enrichment');
  }

  return response.json();
};

export const updateUserConsent = async (allowScraping: boolean) => {
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
    throw new Error('Failed to update user consent');
  }

  return response.json();
};

export const enrichSingleContact = async (contactId: string) => {
  const response = await fetch(`${API_BASE_URL}/contacts/${contactId}/enrich-photo`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to enrich single contact');
  }

  return response.json();
};
