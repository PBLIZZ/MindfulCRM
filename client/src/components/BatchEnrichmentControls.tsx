import React, { useState } from 'react';

interface EnrichmentStats {
  totalContacts: number;
  contactsWithPhotos: number;
  contactsWithoutPhotos: string[];
}

interface BatchEnrichmentResult {
  processed: number;
  failed: number;
  duration: string;
}

interface BatchEnrichmentControlsProps {
  stats: EnrichmentStats | null;
  startBatchEnrichment: () => Promise<BatchEnrichmentResult>;
}

const BatchEnrichmentControls: React.FC<BatchEnrichmentControlsProps> = ({ 
  stats, 
  startBatchEnrichment 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{processed: number, failed: number, duration: string} | null>(null);

  if (!stats) {
    return (
      <div className="p-3 border rounded bg-gray-50">
        <p className="text-sm text-gray-600">Loading enrichment stats...</p>
      </div>
    );
  }

  const handleStartBatch = async (): Promise<void> => {
    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    try {
      // Start with contacts that don't have photos
      const contactsToEnrich = stats.contactsWithoutPhotos ?? [];
      
      if (contactsToEnrich.length === 0) {
        // Alert: No contacts need photo enrichment
        setIsProcessing(false);
        return;
      }

      const result = await startBatchEnrichment();
      setResults(result);
      setProgress(100);
    } catch {
      // Log error and notify user
      setResults({ processed: 0, failed: 1, duration: 'Failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  const contactsNeedingPhotos = stats.totalContacts - stats.contactsWithPhotos;

  return (
    <div className="p-3 border rounded space-y-4">
      <div>
        <h3 className="font-semibold mb-3">Photo Enrichment Stats</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{stats.totalContacts ?? 0}</div>
            <div className="text-sm text-blue-700">Total Contacts</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{stats.contactsWithPhotos ?? 0}</div>
            <div className="text-sm text-green-700">With Photos</div>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded">
            <div className="text-2xl font-bold text-orange-600">{contactsNeedingPhotos ?? 0}</div>
            <div className="text-sm text-orange-700">Need Photos</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button 
          onClick={handleStartBatch}
          disabled={isProcessing || contactsNeedingPhotos === 0}
          className={`w-full py-2 px-4 rounded font-medium ${
            isProcessing || contactsNeedingPhotos === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isProcessing ? 'Processing...' : `Start Batch Enrichment (${contactsNeedingPhotos} contacts)`}
        </button>

        {isProcessing && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
            <div className="text-center text-sm mt-1">{progress}%</div>
          </div>
        )}

        {results && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <h4 className="font-semibold text-green-800 mb-2">Batch Results</h4>
            <div className="text-sm space-y-1">
              <p className="text-green-700">✅ Processed: {results.processed ?? 0}</p>
              <p className="text-red-700">❌ Failed: {results.failed ?? 0}</p>
              <p className="text-gray-700">⏱️ Duration: {results.duration ?? 'N/A'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchEnrichmentControls;
