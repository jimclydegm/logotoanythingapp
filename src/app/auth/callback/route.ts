import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { siteConfig } from '@/config/site';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  
  // Try different ways to get the code
  let code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  // Log all parameters to help debug
  console.log('Auth callback URL:', request.url);
  console.log('All search params:', Object.fromEntries(searchParams.entries()));
  
  // If code is not in the URL directly, check if it's in the hash fragment
  // (Some OAuth providers put the token in the hash part of the URL)
  if (!code && request.url.includes('#')) {
    try {
      const hashParams = new URLSearchParams(request.url.split('#')[1]);
      code = hashParams.get('code');
      console.log('Extracted code from hash fragment:', code);
    } catch (err) {
      console.error('Error parsing hash fragment:', err);
    }
  }
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/';

  // Debug logging to help diagnose issues
  console.log('Auth callback received:', {
    hasCode: !!code,
    hasError: !!error,
    errorDescription,
    url: request.url,
    searchParamsKeys: Array.from(searchParams.keys())
  });

  // If Supabase returns an error directly
  if (error) {
    console.error(`Auth error: ${error}, Description: ${errorDescription}`);
    return NextResponse.redirect(`${siteConfig.url}/auth/auth-code-error?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    console.error('No code provided in callback URL:', request.url);
    
    // Try to handle the case where the user is already signed in
    try {
      const supabase = createServerSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('User already has a session, redirecting to home');
        return NextResponse.redirect(`${siteConfig.url}/`);
      }
    } catch (err) {
      console.error('Error checking session:', err);
    }
    
    return NextResponse.redirect(`${siteConfig.url}/auth/auth-code-error?error=no_code&details=No_authorization_code_found_in_URL`);
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error.message);
      return NextResponse.redirect(`${siteConfig.url}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
    }
    
    // Log successful authentication
    console.log('Successful authentication, redirecting to:', next);
    
    // Successful authentication
    return NextResponse.redirect(`${siteConfig.url}${next}`);
  } catch (error: any) {
    console.error('Unexpected error in auth callback:', error?.message || 'Unknown error');
    return NextResponse.redirect(`${siteConfig.url}/auth/auth-code-error?error=${encodeURIComponent(error?.message || 'unexpected')}`);
  }
} 