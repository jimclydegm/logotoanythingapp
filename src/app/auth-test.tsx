'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/utils/supabase/client';

export default function AuthTest() {
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  async function testAuth() {
    setLoading(true);
    setErrorMsg('');

    try {
      // Get current session from Supabase client
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        setTestResult({ 
          error: 'No session found. Please login first.',
          session: null
        });
        return;
      }
      
      // Make request to verify-session endpoint with Bearer token
      const response = await fetch('/api/verify-session', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const result = await response.json();
      
      setTestResult({
        clientSession: {
          userId: session.user.id,
          hasAccessToken: !!session.access_token,
          accessTokenPreview: session.access_token.substring(0, 10) + '...',
        },
        serverResult: result
      });
    } catch (error) {
      setTestResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Test</h1>
      
      <button 
        onClick={testAuth}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Auth Flow'}
      </button>
      
      {testResult && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Test Results</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[500px]">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 