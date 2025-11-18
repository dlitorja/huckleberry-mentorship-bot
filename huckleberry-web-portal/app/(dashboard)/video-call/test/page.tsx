"use client";
// Test page for video call APIs
// This is a development-only page for testing API endpoints

import { useState } from "react";

export default function VideoCallTestPage() {
  const [mentorshipId, setMentorshipId] = useState("");
  const [callId, setCallId] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testEndpoint = async (endpoint: string, method: string = "GET", body?: any): Promise<any> => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(endpoint, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResults(data);
      return data;
    } catch (err: any) {
      setError(err.message || "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const testToken = () => {
    if (!mentorshipId) {
      setError("Please enter a mentorship ID");
      return;
    }
    testEndpoint("/api/video-call/token", "POST", { mentorshipId });
  };

  const testStart = async () => {
    if (!mentorshipId) {
      setError("Please enter a mentorship ID");
      return;
    }
    const data = await testEndpoint("/api/video-call/start", "POST", { mentorshipId });
    if (data?.callId) {
      setCallId(data.callId);
    }
  };

  const testEnd = () => {
    if (!callId) {
      setError("Please enter a call ID (start a call first)");
      return;
    }
    testEndpoint("/api/video-call/end", "POST", { callId });
  };

  const testHistory = () => {
    if (!mentorshipId) {
      setError("Please enter a mentorship ID");
      return;
    }
    testEndpoint(`/api/video-call/history?mentorshipId=${mentorshipId}`, "GET");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Video Call API Test Page</h1>
      <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6">
        This page is for testing video call APIs. Make sure you&apos;re logged in and have a valid mentorship ID.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Mentorship ID (UUID):
          </label>
          <input
            type="text"
            value={mentorshipId}
            onChange={(e) => setMentorshipId(e.target.value)}
            placeholder="Enter mentorship UUID"
            className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
          />
        </div>

        {callId && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Call ID (from start response):
            </label>
            <input
              type="text"
              value={callId}
              onChange={(e) => setCallId(e.target.value)}
              placeholder="Call ID will appear here after starting a call"
              className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={testToken}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Test Token API
        </button>
        <button
          onClick={testStart}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Test Start Call
        </button>
        <button
          onClick={testEnd}
          disabled={loading || !callId}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          Test End Call
        </button>
        <button
          onClick={testHistory}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          Test History
        </button>
      </div>

      {loading && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md mb-4">
          <p className="text-blue-700 dark:text-blue-300">Loading...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md mb-4">
          <p className="text-red-700 dark:text-red-300 font-medium">Error:</p>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {results && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
          <p className="text-green-700 dark:text-green-300 font-medium mb-2">Response:</p>
          <pre className="text-sm overflow-auto bg-white dark:bg-neutral-900 p-3 rounded border">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 dark:bg-neutral-900 rounded-md">
        <h2 className="font-medium mb-2">How to use:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-neutral-400">
          <li>Get a mentorship ID from your dashboard or database</li>
          <li>Enter it in the &quot;Mentorship ID&quot; field above</li>
          <li>Click &quot;Test Token API&quot; to generate an Agora token</li>
          <li>Click &quot;Test Start Call&quot; to create a call record</li>
          <li>Click &quot;Test End Call&quot; to end the call (call ID will be auto-filled)</li>
          <li>Click &quot;Test History&quot; to see all calls for this mentorship</li>
        </ol>
      </div>
    </div>
  );
}

