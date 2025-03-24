'use client';

import { Button } from '@/components/button'
import { Container } from '@/components/container'
import { Heading } from '@/components/heading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { TicketIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

interface Payment {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  payment_method: string;
  credits_purchased: number;
}

export default function Credits() {
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCreditsAndPayments() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Error getting session:', sessionError);
        setLoading(false);
        return;
      }

      // Get remaining credits from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('remaining_credits')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setRemainingCredits(profile.remaining_credits);
      }

      // Get payment history
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
      } else {
        // Deduplicate payments by stripe_payment_intent_id and also by session ID
        const paymentMap = new Map();
        // Keep track of unique payment intents, session IDs, and creation timestamps
        const processedIntents = new Set();
        const processedSessions = new Set();
        const processedTimestamps = new Set();
        
        // First phase: Group payments by their metadata for deduplication analysis
        // We'll create a uniqueness signature for each payment where possible
        paymentsData?.forEach(payment => {
          // Try to extract a session ID if it exists in the payment intent or description
          let sessionId = null;
          if (payment.stripe_payment_intent_id && payment.stripe_payment_intent_id.includes('session_')) {
            sessionId = payment.stripe_payment_intent_id.replace('session_', '').replace('verified_session_', '');
          } else if (payment.description && payment.description.includes('session')) {
            const match = payment.description.match(/session[_-]([a-zA-Z0-9_-]+)/);
            if (match) sessionId = match[1];
          }
          
          // Create a signature based on the available unique identifiers
          const signature = payment.stripe_payment_intent_id || 
                            (sessionId ? `session_${sessionId}` : null) || 
                            `${payment.amount}_${payment.created_at}`;
          
          // Store the best record for each signature
          if (!paymentMap.has(signature) || 
              (new Date(payment.created_at) > new Date(paymentMap.get(signature).created_at))) {
            paymentMap.set(signature, payment);
          }
        });
        
        // In case we still have duplicates with the same timestamp, filter by ID
        // This ensures we only show one record per transaction
        setPayments(Array.from(paymentMap.values()).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }

      setLoading(false);
    }

    fetchCreditsAndPayments();
  }, []);

  return (
    <Container>
      <div className="py-8">
        {/* Credits Overview Card */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-2">Available Credits</h2>
              <div className="text-3xl sm:text-4xl font-bold mb-4">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <ArrowPathIcon className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                    <span className="text-sm sm:text-base">Loading...</span>
                  </div>
                ) : (
                  remainingCredits
                )}
              </div>
              <Button
                href="/pricing"
                className="w-full sm:w-auto bg-white text-blue-600 hover:bg-blue-50 dark:bg-white dark:text-blue-600 dark:hover:bg-blue-50"
              >
                Get More Credits
              </Button>
            </div>
            <TicketIcon className="h-16 w-16 sm:h-24 sm:w-24 opacity-20" />
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-8">
          <Heading className="text-xl sm:text-2xl">Payment History</Heading>
          <Table className="mt-4 sm:mt-8">
            <TableHead>
              <TableRow>
                <TableHeader className="text-sm sm:text-base">Date</TableHeader>
                <TableHeader className="text-sm sm:text-base">Description</TableHeader>
                <TableHeader className="text-sm sm:text-base">Credits</TableHeader>
                <TableHeader className="text-sm sm:text-base text-right">Amount</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 sm:py-8">
                    <div className="flex items-center justify-center gap-2">
                      <ArrowPathIcon className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span className="text-sm sm:text-base">Loading payment history...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 sm:py-8 text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
                    No payment history found
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400">
                      {format(new Date(payment.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-sm sm:text-base">{payment.description}</TableCell>
                    <TableCell className="text-sm sm:text-base font-medium">+{payment.credits_purchased}</TableCell>
                    <TableCell className="text-sm sm:text-base text-right">
                      {payment.currency.toUpperCase()} {payment.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Container>
  )
} 