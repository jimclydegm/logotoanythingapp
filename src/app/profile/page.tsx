'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import Link from 'next/link';
import { supabaseClient } from '@/utils/supabase/client';
import { Session } from '@supabase/supabase-js';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface Subscription {
  status: string;
  plan_id: string;
  subscription_period_end: string;
  is_annual: boolean;
}

interface Credits {
  remaining: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [dateJoined, setDateJoined] = useState<string | null>(null);

  const fetchUserData = async (userId: string) => {
    // Fetch subscription
    const { data: subscriptionData, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subscriptionError) {
      console.error('Error fetching subscription:', subscriptionError);
    } else {
      setSubscription(subscriptionData);
    }

    // Fetch credits and date joined from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('remaining_credits, created_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    } else {
      setCredits({ remaining: profile.remaining_credits });
      setDateJoined(profile.created_at);
    }
  };

  useEffect(() => {
    async function getSession() {
      setLoading(true);
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.error('Error fetching session:', error.message);
      }
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      setSession(session);
      await fetchUserData(session.user.id);
      setLoading(false);

      // Set up auth state listener
      const {
        data: { subscription },
      } = supabaseClient.auth.onAuthStateChange(async (_event: string, session: Session | null) => {
        if (!session) {
          router.push('/login');
        } else {
          setSession(session);
          await fetchUserData(session.user.id);
        }
      });

      return () => subscription.unsubscribe();
    }

    getSession();
  }, [router]);

  const handleSignOut = async () => {
    await supabaseClient.auth.signOut();
    router.push('/');
  };

  const handleRefresh = async () => {
    if (session?.user.id) {
      await fetchUserData(session.user.id);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/70">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-white">Loading profile...</h2>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // This will be handled by the useEffect
  }

  const user = session.user;
  const userMeta = user.user_metadata || {};

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-800/90">
        <div className="px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Avatar
                src={userMeta.avatar_url || null}
                className="size-24"
                square
                initials={user.email?.[0]?.toUpperCase() || 'U'}
              />
              <div>
                <h3 className="text-2xl font-bold leading-tight text-zinc-900 dark:text-white">
                  {userMeta.full_name || userMeta.name || user.email || 'User'}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                  {user.email || ''}
                </p>
              </div>
            </div>
            <Button onClick={handleRefresh} plain>
              <ArrowPathIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-700">
          <dl>
            <div className="bg-zinc-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 dark:bg-zinc-800/50">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Full name</dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-white">
                {userMeta.full_name || userMeta.name || 'Not provided'}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 dark:bg-zinc-800">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Email address</dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-white">
                {user.email || 'Not provided'}
              </dd>
            </div>
            {userMeta.provider && (
              <div className="bg-zinc-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 dark:bg-zinc-800/50">
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Sign-in provider</dt>
                <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-white capitalize">
                  {userMeta.provider}
                </dd>
              </div>
            )}
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 dark:bg-zinc-800">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Subscription</dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-white">
                {subscription ? (
                  <div>
                    <div className="font-medium capitalize">{subscription.plan_id}</div>
                    <div className="text-zinc-500 dark:text-zinc-400">
                      {subscription.is_annual ? 'Annual' : 'Monthly'} plan
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400">
                      Renews on {new Date(subscription.subscription_period_end).toLocaleDateString()}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-zinc-500 dark:text-zinc-400">No active subscription</div>
                    <Link href="/pricing" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      View plans
                    </Link>
                  </div>
                )}
              </dd>
            </div>
            <div className="bg-zinc-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 dark:bg-zinc-800/50">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Credits</dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-white">
                {credits ? (
                  <div>
                    <div className="font-medium">{credits.remaining} credits remaining</div>
                    <Link href="/credits" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      View credit history
                    </Link>
                  </div>
                ) : (
                  <div className="text-zinc-500 dark:text-zinc-400">Loading credits...</div>
                )}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 dark:bg-zinc-800">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Date joined</dt>
              <dd className="mt-1 text-sm text-zinc-900 sm:col-span-2 sm:mt-0 dark:text-white">
                {dateJoined ? new Date(dateJoined).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'Loading...'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex justify-end border-t border-zinc-200 px-4 py-5 dark:border-zinc-700">
          <Button 
            onClick={handleSignOut}
            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700">
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
} 