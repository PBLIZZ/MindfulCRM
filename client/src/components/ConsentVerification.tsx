import React from 'react';
import { updateUserConsent } from '../api/photoEnrichmentApi';

interface ConsentVerificationProps {
  profile: any;
}

const ConsentVerification: React.FC<ConsentVerificationProps> = ({ profile }) => {
  if (!profile) {
    return (
      <div className="p-3 border rounded bg-gray-50">
        <p className="text-sm text-gray-600">Loading consent status...</p>
      </div>
    );
  }

  const hasConsent = profile.allowProfilePictureScraping || false;

  const handleGrantConsent = async () => {
    try {
      await updateUserConsent(true);
      window.location.reload(); // Refresh to update UI
    } catch (error) {
      console.error('Failed to grant consent:', error);
      alert('Failed to grant consent. Please try again.');
    }
  };

  return (
    <div className="p-3 border rounded">
      <div className={`flex items-center gap-3 ${hasConsent ? 'text-green-700' : 'text-amber-700'}`}>
        <div className="text-2xl">
          {hasConsent ? '✅' : '⚠️'}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">GDPR Consent Status</h3>
          <p className="text-sm">
            {hasConsent 
              ? 'You have consented to contact profile picture enrichment'
              : 'Consent required for contact profile picture enrichment'
            }
          </p>
          {!hasConsent && (
            <button 
              onClick={handleGrantConsent}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              Grant Consent
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsentVerification;
