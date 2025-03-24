'use client';

import { Button } from '@/components/button';
import { Container } from '@/components/container';
import { Heading } from '@/components/heading';
import { Badge } from '@/components/badge';
import { useState, useEffect, Suspense } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams, useRouter } from 'next/navigation';

interface PlanType {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  buttonText: string;
  popular: boolean;
  priceId: string;
  originalPrice?: string;
}

interface Payment {
  id: string;
  stripe_payment_intent_id?: string;
  description?: string;
}

const subscriptionPlans: PlanType[] = [
  {
    name: 'Basic',
    price: '9.99',
    period: '/month',
    description: 'Ideal for personal use',
    features: [
      '50 generations per month',
      'Basic logo transformations',
      'Standard support',
      'Access to basic templates',
      'Email support'
    ],
    buttonText: 'Start Basic Plan',
    popular: false,
    priceId: 'price_1Qz7m5JQXYIqduwFzbMveA5T'
    // priceId: 'price_1QyYm4JQXYIqduwFVF5F2QDN' // Test
  },
  {
    name: 'Advanced',
    price: '19.99',
    period: '/month',
    description: 'Ideal for startups',
    features: [
      '150 generations per month',
      'Advanced transformations',
      'Priority support',
      'Access to all templates',
      'Custom backgrounds',
      'Batch processing'
    ],
    buttonText: 'Start Advanced Plan',
    popular: true,
    priceId: 'price_1Qz7mCJQXYIqduwFwAP2SFum'
    // priceId: 'price_1QyYmjJQXYIqduwFCfyTEO5P' // Test
  },
  {
    name: 'Ultimate',
    price: '49.99',
    period: '/month',
    description: 'For professional agencies and power users',
    features: [
      'Unlimited generations',
      'Premium transformations',
      '24/7 Priority support',
      'Custom templates',
      'API access',
      'Dedicated account manager',
      'White-label options'
    ],
    buttonText: 'Start Ultimate Plan',
    popular: false,
    priceId: 'price_1Qz7mHJQXYIqduwF9baX1a7a'
    // priceId: 'price_1QyYnIJQXYIqduwFe6hbAYZW' // Test
  }
];

const oneTimePlans: PlanType[] = [
  {
    name: 'Starter',
    price: '9.09',
    originalPrice: '12.99',
    period: '',
    description: 'Perfect for personal use',
    features: [
      '80 credits',
      'Commercial use',
      'No expiry',
      'Standard support'
    ],
    buttonText: 'Buy Starter Pack',
    popular: false,
    priceId: 'price_1Qz7mMJQXYIqduwFtJktqTQW'
    // priceId: 'price_1QyYnlJQXYIqduwFMHh9Wrx3' // Test
  },
  {
    name: 'Pro',
    price: '17.49',
    originalPrice: '24.99',
    period: '',
    description: 'Ideal for startups',
    features: [
      '200 credits',
      'Commercial use',
      'No expiry',
      'Priority support'
    ],
    buttonText: 'Buy Pro Pack',
    popular: true,
    priceId: 'price_1Qz7mRJQXYIqduwFuPjoAfAT'
    // priceId: 'price_1QyYoDJQXYIqduwFF4YGJNpA' // Test
  },
  {
    name: 'Business',
    price: '69.99',
    originalPrice: '99.99',
    period: '',
    description: 'Best value for larger projects',
    features: [
      '1000 credits',
      'Commercial use',
      'No expiry',
      'Priority support',
    ],
    buttonText: 'Buy Business Pack',
    popular: false,
    priceId: 'price_1Qz7maJQXYIqduwFaTnlP4cD'
    // priceId: 'price_1QyYojJQXYIqduwFphe2VsXu' // Test
  }
];

function PricingContent() {
  const router = useRouter();
  const [isSubscription, setIsSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    async function checkSubscription() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setCurrentPlan(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_plan, remaining_credits')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        setCurrentPlan(null);
        return;
      }

      setCurrentPlan(profile.subscription_plan);
      
      // Handle successful Stripe redirect with session ID
      if (success && sessionId) {
        console.log(`Processing successful Stripe redirect with session ID: ${sessionId}`);
        
        try {
          // Get all existing payments for this user to check if this session was already processed
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('id, stripe_payment_intent_id, description')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
            
          if (paymentsError) {
            console.error('Error fetching payments:', paymentsError);
          }
          
          // Check if any existing payment references this session
          const sessionProcessed = payments?.some(payment => 
            payment.stripe_payment_intent_id?.includes(sessionId) || 
            payment.description?.includes(sessionId)
          );
          
          // If payment exists, credits should already be updated
          if (sessionProcessed) {
            console.log(`Payment record found for session ${sessionId}, credits already updated`);
          } else {
            // Delay verification by 3 seconds to give webhook a chance to process
            console.log('Waiting 3 seconds before verifying payment...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check payments again after waiting
            const { data: paymentsAfterWait } = await supabase
              .from('payments')
              .select('id, stripe_payment_intent_id, description')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
              .limit(5);
              
            const sessionProcessedAfterWait = (paymentsAfterWait as Payment[] | null)?.some(payment => 
              payment.stripe_payment_intent_id?.includes(sessionId) || 
              payment.description?.includes(sessionId)
            );
            
            if (sessionProcessedAfterWait) {
              console.log(`Payment processed by webhook during wait period`);
            } else {
              // Payment record doesn't exist, webhook might have failed
              // Call verification API to ensure credits are updated
              console.log('No payment record found, attempting verification...');
              const verifyResponse = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ 
                  sessionId 
                })
              });
              
              if (!verifyResponse.ok) {
                const errorText = await verifyResponse.text();
                console.error(`Failed to verify payment: ${verifyResponse.status} - ${errorText}`);
              } else {
                const result = await verifyResponse.json();
                console.log('Payment verification successful:', result);
              }
            }
          }
        } catch (error) {
          console.error('Error during payment verification:', error);
        }
      }
    }

    checkSubscription();
  }, [success, sessionId]);

  const handleSubscription = async (priceId: string) => {
    try {
      setIsLoading(priceId);

      // Get the session token
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        router.push('/login');
        return;
      }

      console.log('Session token present:', !!session.access_token);

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Payment API error:', {
          status: response.status,
          data: data
        });
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.sessionUrl) {
        throw new Error('No checkout URL received');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.sessionUrl;
    } catch (error) {
      console.error('Subscription error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start subscription. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setIsLoading('manage');

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get session: ' + sessionError.message);
      }

      if (!session) {
        throw new Error('Please sign in to manage subscription');
      }

      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.url) {
        throw new Error('No portal URL received');
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (error) {
      console.error('Customer portal error:', error);
      alert(error instanceof Error ? error.message : 'Failed to open customer portal. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Container>
      <div className="py-8">
        {success && (
          <div className="mb-8 rounded-md bg-green-50 p-4 dark:bg-green-900/10">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Successfully subscribed! Your credits have been updated.
                </p>
              </div>
            </div>
          </div>
        )}
        {canceled && (
          <div className="mb-8 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/10">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Payment canceled. Please try again.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <Heading>Simple, transparent pricing</Heading>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Choose the perfect plan for your needs. No hidden fees.
          </p>
        </div>

        {/* Toggle between subscription and one-time */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => setIsSubscription(true)}
            disabled={true}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-not-allowed opacity-50 ${
              isSubscription
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            Monthly Subscription (Temporarily Unavailable)
          </button>
          <button
            onClick={() => setIsSubscription(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !isSubscription
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            One-Time Payment
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {(isSubscription ? subscriptionPlans : oneTimePlans).map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col h-full rounded-2xl border ${
                plan.popular
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-900/10'
                  : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
              } p-8 shadow-lg ${isSubscription ? 'opacity-50' : ''}`}
            >
              {isSubscription && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-2xl">
                  <span className="bg-white dark:bg-zinc-900 px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Coming soon
                  </span>
                </div>
              )}

              {plan.popular && (
                <Badge color="blue" className="absolute -top-2 right-6">
                  Most Popular
                </Badge>
              )}

              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {plan.name}
              </h3>

              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                {plan.description}
              </p>

              <div className="mt-4 flex items-baseline">
                <div className="flex flex-col">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      ${plan.price}
                    </span>
                    {!isSubscription && plan.originalPrice && (
                      <span className="ml-2 text-lg text-zinc-500 line-through">
                        ${plan.originalPrice}
                      </span>
                    )}
                  </div>
                  {!isSubscription && (
                    <div className="mt-1">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        Save 30% on launch promo
                      </span>
                    </div>
                  )}
                </div>
                {isSubscription && (
                  <span className="ml-1 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    {plan.period}
                  </span>
                )}
              </div>

              <ul className="mt-8 flex-grow space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <CheckIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />
                    <span className="ml-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => {
                  if (isSubscription) return;
                  handleSubscription(plan.priceId);
                }}
                disabled={isLoading === plan.priceId || isLoading === 'manage' || isSubscription}
                className={`mt-8 w-full justify-center ${
                  plan.popular
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                    : ''
                }`}
              >
                {isLoading === plan.priceId ? 'Processing...' : 
                 isLoading === 'manage' ? 'Loading...' :
                 isSubscription ? 'Coming Soon' :
                 plan.buttonText}
              </Button>
            </div>
          ))}
        </div>

        {/* FAQ or additional info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All plans include access to our basic features. Need a custom plan?{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </Container>
  );
}

export default function Pricing() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Loading pricing information...</p>
        </div>
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}