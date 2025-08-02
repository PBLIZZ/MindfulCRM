import React, { useState, useEffect } from 'react';
import { fetchPhotoEnrichmentStats, fetchUserProfile, startBatchEnrichment } from '../../api/photoEnrichmentApi';
import ConsentVerification from '../ConsentVerification';
import BatchEnrichmentControls from '../BatchEnrichmentControls';

const PhotoEnrichment = () => {
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
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
          <ConsentVerification profile={profile} />
          <BatchEnrichmentControls stats={stats} startBatchEnrichment={startBatchEnrichment} />
        </>
      )}
    </div>
  );
};

export default PhotoEnrichment;

