import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Log all environment variables related to Stripe (except secret values)
console.log('Stripe environment check:', {
  hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
  nodeEnv: process.env.NODE_ENV,
});

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Simple UUID v4 generator
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Map Stripe subscription status to our database enum
function mapSubscriptionStatus(stripeStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'active': 'active',
    'canceled': 'canceled',
    'incomplete': 'unpaid',
    'incomplete_expired': 'canceled',
    'past_due': 'past_due',
    'trialing': 'trialing',
    'unpaid': 'unpaid'
  };
  
  return statusMap[stripeStatus] || 'unpaid';
}

// Handle all HTTP methods with detailed logging
export async function GET(req: Request) {
  console.log('GET request to webhook endpoint');
  return NextResponse.json(
    { message: 'Stripe webhook endpoint is working. Please use POST for webhook events.' },
    { 
      status: 200,
      headers: {
        'Allow': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
      } 
    }
  );
}

export async function HEAD(req: Request) {
  console.log('HEAD request to webhook endpoint');
  return new Response(null, { 
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
    } 
  });
}

export async function OPTIONS(req: Request) {
  console.log('OPTIONS request to webhook endpoint');
  return new Response(null, { 
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
    } 
  });
}

// Handle PUT and DELETE to prevent 405 errors
export async function PUT(req: Request) {
  console.log('PUT request to webhook endpoint');
  return NextResponse.json(
    { message: 'Stripe webhook endpoint only accepts POST requests for events' },
    { 
      status: 405,
      headers: {
        'Allow': 'POST, OPTIONS, GET, HEAD',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
      } 
    }
  );
}

export async function DELETE(req: Request) {
  console.log('DELETE request to webhook endpoint');
  return NextResponse.json(
    { message: 'Stripe webhook endpoint only accepts POST requests for events' },
    { 
      status: 405,
      headers: {
        'Allow': 'POST, OPTIONS, GET, HEAD',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
      } 
    }
  );
}

export async function POST(req: Request) {
  console.log('POST request to webhook endpoint received at:', new Date().toISOString());
  console.log('Request URL:', req.url);
  const requestHeaders = Object.fromEntries(req.headers);
  console.log('Request headers:', {
    ...requestHeaders,
    'stripe-signature': requestHeaders['stripe-signature'] ? '[PRESENT]' : '[MISSING]',
    'authorization': requestHeaders['authorization'] ? '[PRESENT]' : '[MISSING]'
  });

  const body = await req.text();
  const signature = headers().get('stripe-signature');

  console.log(`Webhook body length: ${body.length} characters`);

  if (!signature) {
    console.error('No stripe-signature header found');
    return NextResponse.json(
      { error: 'No signature found' },
      { 
        status: 400,
        headers: {
          'Allow': 'POST, OPTIONS, GET, HEAD',
          'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
        }
      }
    );
  }

  let event: Stripe.Event;

  try {
    // Log the signature and secret prefix for debugging (don't log full secret)
    console.log('Signature header present:', !!signature);
    console.log('Webhook secret prefix:', process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 5) + '...');
    
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    
    console.log(`Webhook verified: ${event.type}, id: ${event.id}`);
    
    // Extract session data for logging
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Session details:', {
        id: session.id,
        mode: session.mode,
        userId: session.metadata?.userId,
        plan: session.metadata?.plan,
        payment_status: session.payment_status
      });
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { 
        status: 400,
        headers: {
          'Allow': 'POST, OPTIONS, GET, HEAD',
          'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
        }
      }
    );
  }

  try {
    console.log(`Processing event: ${event.type}`);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Processing checkout.session.completed: ${session.id}, mode: ${session.mode}`);
        
        if (session.mode === 'subscription') {
          await handleCheckoutSessionCompleted(session);
        } else {
          await handleOneTimePaymentCompleted(session);
        }
        console.log(`Successfully processed checkout.session.completed: ${session.id}`);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }
    }

    console.log(`Event ${event.id} processed successfully`);
    return NextResponse.json(
      { received: true },
      {
        headers: {
          'Allow': 'POST, OPTIONS, GET, HEAD',
          'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
        }
      }
    );
  } catch (err) {
    console.error(`Error processing webhook ${event.type}:`, err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { 
        status: 500,
        headers: {
          'Allow': 'POST, OPTIONS, GET, HEAD',
          'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, HEAD, PUT, DELETE',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, stripe-signature'
        }
      }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  
  if (!userId || !plan) return;

  // Create subscription record
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .insert({
      id: generateUUID(),
      user_id: userId,
      plan_id: await getPlanId(plan),
      status: 'active',
      subscription_period_start: new Date().toISOString(),
      subscription_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      stripe_subscription_id: session.subscription as string,
      is_annual: plan.toLowerCase().includes('yearly'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (subscriptionError) {
    console.error('Error creating subscription record:', subscriptionError);
    throw subscriptionError;
  }

  // Update profile with subscription details
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_plan: plan,
      stripe_customer_id: session.customer as string,
      subscription_period_start: new Date().toISOString(),
      subscription_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      remaining_credits: getPlanCredits(plan),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (profileError) {
    console.error('Error updating profile:', profileError);
    throw profileError;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const plan = subscription.items.data[0]?.price.nickname || 'basic';
  const stripeStatus = subscription.status;
  console.log('Stripe status:', stripeStatus);
  
  const status = mapSubscriptionStatus(stripeStatus);
  console.log('Mapped status:', status);
  
  const isAnnual = subscription.items.data[0]?.price.recurring?.interval === 'year';

  // Update subscription record
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .update({
      status: status,
      plan_id: await getPlanId(plan),
      subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      is_annual: isAnnual,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (subscriptionError) {
    console.error('Error updating subscription record:', subscriptionError);
    throw subscriptionError;
  }

  // Get user_id from subscription
  const { data: subscriptionData } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!subscriptionData?.user_id) {
    console.error('No user_id found for subscription:', subscription.id);
    return;
  }

  // Update profile with subscription details
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_status: status,
      subscription_plan: plan,
      subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      remaining_credits: getPlanCredits(plan), // Reset credits on plan change
      updated_at: new Date().toISOString()
    })
    .eq('id', subscriptionData.user_id);

  if (profileError) {
    console.error('Error updating profile:', profileError);
    throw profileError;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const now = new Date().toISOString();

  // Update subscription record
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: now,
      updated_at: now,
      cancel_at_period_end: true
    })
    .eq('stripe_subscription_id', subscription.id);

  if (subscriptionError) {
    console.error('Error updating subscription record:', subscriptionError);
    throw subscriptionError;
  }

  // Get user_id from subscription
  const { data: subscriptionData } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!subscriptionData?.user_id) {
    console.error('No user_id found for subscription:', subscription.id);
    return;
  }

  // Update profile with subscription details
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      subscription_plan: null,
      subscription_period_start: null,
      subscription_period_end: null,
      remaining_credits: 0,
      updated_at: now
    })
    .eq('id', subscriptionData.user_id);

  if (profileError) {
    console.error('Error updating profile:', profileError);
    throw profileError;
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const plan = subscription.items.data[0]?.price.nickname || 'basic';
  const isAnnual = subscription.items.data[0]?.price.recurring?.interval === 'year';

  // Update subscription record
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .update({
      plan_id: await getPlanId(plan),
      is_annual: isAnnual,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (subscriptionError) {
    console.error('Error updating subscription record:', subscriptionError);
    throw subscriptionError;
  }

  // Get user_id from subscription
  const { data: subscriptionData } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!subscriptionData?.user_id) {
    console.error('No user_id found for subscription:', subscription.id);
    return;
  }

  // Update profile with subscription details
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_plan: plan,
      subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      remaining_credits: getPlanCredits(plan), // Reset credits on renewal
      updated_at: new Date().toISOString()
    })
    .eq('id', subscriptionData.user_id);

  if (profileError) {
    console.error('Error updating profile:', profileError);
    throw profileError;
  }
}

async function handleOneTimePaymentCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  
  if (!userId || !plan) {
    console.error('Missing userId or plan in session metadata:', { userId, plan, sessionId: session.id });
    return;
  }

  try {
    console.log(`Processing one-time payment for user ${userId}, plan ${plan}, session ${session.id}`);
    
    // Get payment_intent ID or use session ID as fallback
    const paymentIntentId = session.payment_intent 
      ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id) 
      : `session_${session.id}`;
    
    console.log(`Payment intent ID: ${paymentIntentId} for session ${session.id}`);

    // ROBUST DEDUPLICATION - Check all existing payments
    const { data: allPayments } = await supabase
      .from('payments')
      .select('id, stripe_payment_intent_id, description')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    // Check if ANY payment references this session ID or payment intent
    const paymentExists = allPayments?.some(payment => 
      (payment.stripe_payment_intent_id && 
        (payment.stripe_payment_intent_id.includes(paymentIntentId) || 
         payment.stripe_payment_intent_id.includes(session.id))) ||
      (payment.description && 
        (payment.description.includes(paymentIntentId) || 
         payment.description.includes(session.id)))
    );
    
    if (paymentExists) {
      console.log(`Payment for session ${session.id} was already processed, skipping`);
      return;
    }

    // Get current profile to check existing credits
    const { data: currentProfile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('remaining_credits')
      .eq('id', userId)
      .single();

    if (profileFetchError) {
      console.error(`Error fetching current profile for user ${userId}:`, profileFetchError);
      throw profileFetchError;
    }

    // Calculate new credits (add to existing)
    const planCredits = getPlanCredits(plan);
    const currentCredits = currentProfile?.remaining_credits || 0;
    const newCredits = currentCredits + planCredits;
    
    console.log(`Credit calculation for user ${userId}: current=${currentCredits}, adding=${planCredits}, new=${newCredits}`);

    // Create payment record with a new UUID
    const paymentId = generateUUID();
    
    console.log(`Creating payment record ${paymentId} for user ${userId}, session ${session.id}`);

    // Create payment record
    const { data: paymentData, error: paymentError } = await supabase
      .from('payments')
      .insert({
        id: paymentId,
        user_id: userId,
        amount: (session.amount_subtotal || 0) / 100, // Use amount_subtotal to get original amount before discounts
        currency: session.currency || 'usd',
        status: 'completed',
        description: `One-time payment for ${plan} plan`,
        payment_method: session.payment_method_types?.[0] || 'card',
        stripe_payment_intent_id: paymentIntentId,
        stripe_payment_method_id: session.payment_method_types?.[0] || 'card',
        credits_purchased: planCredits,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error(`Error creating payment record for user ${userId}:`, paymentError);
      throw paymentError;
    }

    // Update profile with new credits
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        remaining_credits: newCredits,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error(`Error updating profile credits for user ${userId}:`, profileUpdateError);
      
      // Attempt to rollback by removing the payment record if possible
      try {
        await supabase
          .from('payments')
          .delete()
          .eq('id', paymentData.id);
        console.log(`Rolled back payment record ${paymentData.id} due to profile update failure`);
      } catch (rollbackError) {
        console.error(`Failed to rollback payment record ${paymentData.id}:`, rollbackError);
      }
      
      throw profileUpdateError;
    }

    console.log(`Successfully processed payment and updated credits for user ${userId}. Payment ID: ${paymentData.id}, New credits: ${newCredits}`);
  } catch (error) {
    console.error(`Critical error in handleOneTimePaymentCompleted for user ${userId}, session ${session.id}:`, error);
    throw error;
  }
}

// Helper function to get plan ID from plan name
async function getPlanId(plan: string): Promise<string> {
  // Clean up the plan name to match our database format
  const cleanPlan = plan.toLowerCase().replace(' yearly', '').replace(' monthly', '');
  
  // Map of plan names to their IDs
  const planIds: { [key: string]: string } = {
    'basic': '60c2cfb7-8616-424a-822f-XXXXXXXXXXXX',
    'advanced': 'a901e21c-f8b2-4bd8-ba71-XXXXXXXXXXXX',
    'ultimate': '42f8edb9-dc05-490c-8745-XXXXXXXXXXXX',
    'starter': '8f5c0fff-abe1-422b-bd19-XXXXXXXXXXXX',
    'pro': '025e3477-96c9-4dfa-9525-XXXXXXXXXXXX',
    'business': '554e0ba1-32f5-4338-a636-XXXXXXXXXXXX'
  };

  const planId = planIds[cleanPlan];
  if (!planId) {
    console.error('Plan not found:', cleanPlan);
    throw new Error(`Plan not found: ${cleanPlan}`);
  }

  return planId;
}

// Helper function to get credits based on plan
function getPlanCredits(plan: string): number {
  const planCredits: { [key: string]: number } = {
    'basic': 50,
    'advanced': 150,
    'ultimate': 999999, // Unlimited
    'starter': 80,
    'pro': 200,
    'business': 1000
  };
  
  return planCredits[plan.toLowerCase()] || 0;
} 