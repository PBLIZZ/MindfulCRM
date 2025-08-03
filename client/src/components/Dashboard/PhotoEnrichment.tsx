import { useState, useEffect } from 'react';
import { fetchPhotoEnrichmentStats, fetchUserProfile, startBatchEnrichment } from '../../api/photoEnrichmentApi.js';
import ConsentVerification from '../ConsentVerification.js';
import BatchEnrichmentControls from '../BatchEnrichmentControls.js';

interface PhotoEnrichmentStats {
  totalContacts: number;
  enrichedContacts: number;
  pendingEnrichment: number;
  failedEnrichment: number;
  lastRunTime?: string;
}

interface UserProfile {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  allowProfilePictureScraping: boolean;
  gdprConsentDate?: string;
  gdprConsentVersion: string;
}

const PhotoEnrichment = () => {
  const [stats, setStats] = useState<PhotoEnrichmentStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('PhotoEnrichment: Loading data...');
        const [stats, profile] = await Promise.all([
          fetchPhotoEnrichmentStats(),
          fetchUserProfile(),
        ]);
        console.log('PhotoEnrichment: Stats loaded:', stats);
        console.log('PhotoEnrichment: Profile loaded:', profile);
        setStats(stats);
        setProfile(profile);
      } catch (error) {
        console.error('PhotoEnrichment: Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Photo Enrichment</h2>
      <div>Loading...</div>
    </div>
  );

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h2 className="text-lg font-semibold">Photo Enrichment Admin</h2>
      {!stats && !profile ? (
        <div className="text-red-500">Failed to load data. Check console for errors.</div>
      ) : (
        <>
          {profile && <ConsentVerification profile={profile} />}
          <BatchEnrichmentControls 
            stats={stats ? {
              totalContacts: stats.totalContacts,
              contactsWithPhotos: stats.enrichedContacts,
              contactsWithoutPhotos: []  // This would need to be fetched separately
            } : null} 
            startBatchEnrichment={async () => {
              const result = await startBatchEnrichment([]);
              return {
                processed: result.contactIds.length || 0,
                failed: 0, // BatchEnrichmentResponse doesn't track failures
                duration: 'N/A' // BatchEnrichmentResponse doesn't track duration
              };
            }} 
          />
        </>
      )}
    </div>
  );
};

export default PhotoEnrichment;

