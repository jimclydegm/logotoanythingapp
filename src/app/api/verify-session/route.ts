import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // Get all cookies for debugging
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // Get access token from Authorization header
    const authHeader = request.headers.get('Authorization') || '';
    const accessToken = authHeader.replace('Bearer ', '');
    
    let userData = null;
    let authError = null;
    
    // Try to get user with token if available
    if (accessToken) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      );
      
      const { data, error } = await supabase.auth.getUser(accessToken);
      userData = data.user;
      authError = error;
    }
    
    return NextResponse.json({ 
      isAuthenticated: !!userData,
      userId: userData?.id,
      authMethod: accessToken ? 'token' : 'none',
      authError: authError?.message,
      cookieCount: allCookies.length,
      cookieNames: allCookies.map(c => c.name),
      hasAuthHeader: !!authHeader,
    });

  } catch (error) {
    console.error('Error verifying session:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 