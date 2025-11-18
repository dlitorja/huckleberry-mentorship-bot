// app/(dashboard)/video-call/[mentorshipId]/recordings/page.tsx
// Page to display recorded videos for a mentorship

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Play, Download, FileVideo, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Recording {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  recording_status: string;
  recording_url: string | null;
  recording_key: string | null;
  recording_size: number | null;
  recording_duration_seconds: number | null;
  recording_signed_url?: string | null;
}

export default function VideoRecordingsPage() {
  const params = useParams();
  const mentorshipId = params.mentorshipId as string;
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecordings() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/video-call/recordings?mentorshipId=${mentorshipId}&includeSignedUrl=true`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch recordings');
        }

        const data = await response.json();
        setRecordings(data.recordings);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch recordings');
        console.error('Error fetching recordings:', err);
      } finally {
        setLoading(false);
      }
    }

    if (mentorshipId) {
      fetchRecordings();
    }
  }, [mentorshipId]);

  const formatDuration = (durationSeconds: number | null) => {
    if (!durationSeconds) return 'Unknown';
    
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-neutral-400">Loading recordings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error</p>
          <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Video Recordings</h1>
      
      {recordings.length === 0 ? (
        <div className="text-center py-12">
          <FileVideo className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No recordings yet</h3>
          <p className="text-gray-600 dark:text-neutral-400">
            Recordings of your video calls will appear here after you end a recorded session.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recordings.map((recording) => (
            <div 
              key={recording.id} 
              className="bg-white dark:bg-neutral-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-neutral-700"
            >
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                    <FileVideo className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">Session Recording</h3>
                    
                    <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-neutral-400">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{format(new Date(recording.start_time), 'MMM d, yyyy')}</span>
                    </div>
                    
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-neutral-400">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>{format(new Date(recording.start_time), 'h:mm a')} - {recording.end_time ? format(new Date(recording.end_time), 'h:mm a') : 'N/A'}</span>
                    </div>
                    
                    <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-neutral-400">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>Duration: {formatDuration(recording.recording_duration_seconds)}</span>
                    </div>
                    
                    <div className="mt-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        recording.recording_status === 'recorded' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : recording.recording_status === 'recording'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {recording.recording_status.charAt(0).toUpperCase() + recording.recording_status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {recording.recording_url && (
                  <div className="mt-4 flex space-x-3">
                    <a
                      href={recording.recording_signed_url || recording.recording_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Watch
                    </a>
                    <a
                      href={recording.recording_signed_url || recording.recording_url}
                      download
                      className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-neutral-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}