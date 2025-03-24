'use client';

import { Button } from '@/components/button';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect if the user is already logged in
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Handle Supabase Google sign-in
  const handleGoogleSignIn = async () => {
    try {
      // Let Supabase handle the redirect automatically
      // This uses the site URL configured in your Supabase dashboard
      console.log('Attempting sign in with Google OAuth');
      
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Don't specify redirectTo - let Supabase use its default settings
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'email profile openid',
          },
        },
      });

      if (error) {
        console.error('Error signing in with Google:', error.message);
        // Show error to user
        alert(`Sign in error: ${error.message}`);
      }
    } catch (err) {
      console.error('Unexpected error during sign in:', err);
      alert('An unexpected error occurred during sign in');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/70">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Quick Signin
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Access your account and generate amazing logos
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 pt-4">
          <Button
            onClick={handleGoogleSignIn}
            className="w-full sm:w-48 h-10 px-2 sm:px-4 flex items-center justify-center gap-2 bg-blue-600 border border-blue-700 text-white text-[13px] sm:text-sm font-medium hover:bg-blue-700 dark:bg-blue-600 dark:border-blue-700 dark:text-white dark:hover:bg-blue-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              width="16px"
              height="16px"
            >
              <path
                fill="#FFC107"
                d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
              />
              <path
                fill="#FF3D00"
                d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
              />
              <path
                fill="#4CAF50"
                d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
              />
              <path
                fill="#1976D2"
                d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
              />
            </svg>
            Sign in with Google
          </Button>

          <Button
            disabled
            className="w-full sm:w-48 h-10 px-2 sm:px-4 flex items-center justify-center gap-2 bg-gray-500 border border-gray-600 text-white text-[13px] sm:text-sm font-medium cursor-not-allowed dark:bg-gray-600 dark:border-gray-700 dark:text-white opacity-80"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Sign in with GitHub
          </Button>
        </div>

        <div className="mt-6 text-center text-sm">
          <p className="text-zinc-500 dark:text-zinc-400">
            By signing in, you agree to our{' '}
            <Link href="#" className="text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="#" className="text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300">
          ← Back to home
        </Link>
      </div>
    </div>
  );
} 