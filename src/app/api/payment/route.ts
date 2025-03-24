import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Checkout endpoint
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { priceId } = body;
    const headersList = headers();
    const origin = headersList.get('origin');
    const authHeader = headersList.get('authorization');

    console.log('Auth header received:', authHeader ? 'Present' : 'Missing');
    console.log('Origin:', origin);

    if (!authHeader) {
      console.error('No authorization header found');
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('User fetch error details:', {
        message: userError.message,
        status: userError.status,
        name: userError.name
      });
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Check if user already has an active subscription
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_plan, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // Validate price ID
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Check if this is a subscription price ID
    const isSubscriptionPrice = (priceId.startsWith('price_XXXX') || priceId.startsWith('price_XXXX')) && 
      (priceId === 'price_1QyYm4JQXYIqduwXXXXXXXXX' || // Test Basic
       priceId === 'price_1QyYmjJQXYIqduwXXXXXXXXX' || // Test Advanced
       priceId === 'price_1QyYnIJQXYIqduwXXXXXXXXX' || // Test Ultimate
       priceId === 'price_1Qz7m5JQXYIqduwXXXXXXXXX' || // Live Basic
       priceId === 'price_1Qz7mCJQXYIqduwXXXXXXXXX' || // Live Advanced
       priceId === 'price_1Qz7mHJQXYIqduwXXXXXXXXX'); // Live Ultimate

    // If it's a subscription and user already has an active subscription
    if (isSubscriptionPrice && profile?.subscription_status === 'active') {
      return NextResponse.json(
        { error: 'You already have an active subscription. Please cancel your current subscription before starting a new one.' },
        { status: 400 }
      );
    }

    // Rest of the validation
    if (!user.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // If user had a previous subscription, use the same customer ID
    const customerOptions = profile?.stripe_customer_id ? 
      { customer: profile.stripe_customer_id } : 
      { customer_email: user.email };

    // Create a Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: isSubscriptionPrice ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      ...customerOptions,
      metadata: {
        userId: user.id,
        plan: isSubscriptionPrice ? getPlanFromPriceId(priceId) : getOneTimePlanFromPriceId(priceId)
      },
      allow_promotion_codes: true,
      //discounts: isSubscriptionPrice ? [] : [{
        //coupon: 'MjPPmAkY'  // Test coupon
        //coupon: '6avsVris' // Live coupon
      //}]
    }).catch(stripeError => {
      console.error('Stripe session creation error:', stripeError);
      throw new Error(stripeError.message);
    });

    return NextResponse.json({ sessionUrl: session.url });
  } catch (error) {
    console.error('Payment error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Helper function to get plan name from subscription price ID
function getPlanFromPriceId(priceId: string): string {
  switch (priceId) {
    // Live price IDs
    case 'price_1Qz7m5JQXYIqduwXXXXXXXXX':
      return 'basic';
    case 'price_1Qz7mCJQXYIqduwXXXXXXXXX':
      return 'advanced';
    case 'price_1Qz7mHJQXYIqduwXXXXXXXXX':
      return 'ultimate';
    // Test price IDs
    case 'price_1QyYm4JQXYIqduwXXXXXXXXX':
      return 'basic';
    case 'price_1QyYmjJQXYIqduwXXXXXXXXX':
      return 'advanced';
    case 'price_1QyYnIJQXYIqduwXXXXXXXXX':
      return 'ultimate';
    default:
      return 'basic';
  }
}

// Helper function to get plan name from one-time payment price ID
function getOneTimePlanFromPriceId(priceId: string): string {
  switch (priceId) {
    // Live price IDs
    case 'price_1Qz7mMJQXYIqduwXXXXXXXXX':
      return 'starter';
    case 'price_1Qz7mRJQXYIqduwXXXXXXXXX':
      return 'pro';
    case 'price_1Qz7maJQXYIqduwXXXXXXXXX':
      return 'business';
    // Test price IDs
    case 'price_1QyYnlJQXYIqduwXXXXXXXXX':
      return 'starter';
    case 'price_1QyYoDJQXYIqduwXXXXXXXXX':
      return 'pro';
    case 'price_1QyYojJQXYIqduwXXXXXXXXX':
      return 'business';
    default:
      return 'starter';
  }
}
