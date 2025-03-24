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

// Create admin Supabase client with service role key
const adminSupabase = createClient(
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId } = body;
    const authHeader = headers().get('authorization');

    console.log('Verifying payment for session:', sessionId);

    if (!authHeader) {
      console.error('No authorization header found');
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Create authenticated Supabase client for user operations
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
      console.error('User fetch error:', userError);
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

    // STEP 1: Check ALL existing payments to ensure robust deduplication
    console.log(`Checking for existing payments related to session ${sessionId}`);
    
    const { data: allPayments } = await adminSupabase
      .from('payments')
      .select('id, stripe_payment_intent_id, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    // Check if ANY payment references this session ID in any way
    const sessionProcessed = allPayments?.some(payment => 
      (payment.stripe_payment_intent_id && payment.stripe_payment_intent_id.includes(sessionId)) ||
      (payment.description && payment.description.includes(sessionId))
    );
    
    if (sessionProcessed) {
      console.log(`Session ${sessionId} already has a payment record`);
      return NextResponse.json({
        success: true,
        message: 'Payment already processed',
        alreadyProcessed: true
      });
    }

    // Retrieve the Stripe checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check again with the actual payment_intent ID if available
    if (session.payment_intent) {
      const paymentIntentId = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : session.payment_intent.id;
        
      const { data: existingPaymentByIntent } = await adminSupabase
        .from('payments')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();
        
      if (existingPaymentByIntent) {
        return NextResponse.json({
          success: true,
          message: 'Payment already processed via payment intent',
          alreadyProcessed: true
        });
      }
    }

    // Verify the session belongs to this user
    if (session.metadata?.userId !== user.id) {
      console.error('Session user ID mismatch:', {
        sessionUserId: session.metadata?.userId,
        requestUserId: user.id
      });
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Verify session is completed and paid
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Session is not completed or not paid' },
        { status: 400 }
      );
    }

    // Process based on one-time payment or subscription
    if (session.mode === 'subscription') {
      // For subscriptions, check if we need to update subscription status
      return NextResponse.json({
        success: true,
        message: 'Subscription payment verified'
      });
    } else {
      // For one-time payments, update credits
      const plan = session.metadata?.plan;
      
      if (!plan) {
        return NextResponse.json(
          { error: 'Plan not found in session metadata' },
          { status: 400 }
        );
      }

      // Get current profile to check existing credits - use admin client
      const { data: currentProfile, error: profileFetchError } = await adminSupabase
        .from('profiles')
        .select('remaining_credits')
        .eq('id', user.id)
        .single();

      if (profileFetchError) {
        console.error('Error fetching current profile:', profileFetchError);
        return NextResponse.json(
          { error: 'Failed to fetch user profile' },
          { status: 500 }
        );
      }

      // Calculate new credits (add to existing)
      const planCredits = getPlanCredits(plan);
      const currentCredits = currentProfile?.remaining_credits || 0;
      const newCredits = currentCredits + planCredits;
      
      console.log(`Credit calculation: current=${currentCredits}, adding=${planCredits}, new=${newCredits}`);

      // Get the payment_intent ID if available, otherwise use session ID
      const paymentIntentId = session.payment_intent 
        ? (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id) 
        : `session_${session.id}`;

      // Create a new UUID for the payment record
      const paymentId = generateUUID();
      
      console.log(`Creating payment record ${paymentId} for user ${user.id}, session ${session.id}`);

      // Create payment record with session ID - use admin client
      const { data: paymentData, error: paymentError } = await adminSupabase
        .from('payments')
        .insert({
          id: paymentId,
          user_id: user.id,
          amount: (session.amount_subtotal || 0) / 100,
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
        console.error('Error creating payment record:', paymentError);
        return NextResponse.json(
          { error: 'Failed to create payment record' },
          { status: 500 }
        );
      }

      // Update profile with new credits - use admin client
      const { error: profileUpdateError } = await adminSupabase
        .from('profiles')
        .update({
          remaining_credits: newCredits,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileUpdateError) {
        console.error('Error updating profile credits:', profileUpdateError);
        
        // Attempt to rollback by removing the payment record if possible
        try {
          await adminSupabase
            .from('payments')
            .delete()
            .eq('id', paymentData.id);
        } catch (rollbackError) {
          console.error('Failed to rollback payment record:', rollbackError);
        }
        
        return NextResponse.json(
          { error: 'Failed to update credits' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        paymentId: paymentData.id,
        credits: {
          added: planCredits,
          total: newCredits
        }
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
} 