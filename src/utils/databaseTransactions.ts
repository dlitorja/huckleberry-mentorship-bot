// src/utils/databaseTransactions.ts
// Utilities for atomic database operations to prevent race conditions

import { supabase } from '../bot/supabaseClient.js';
import { logger } from './logger.js';

/**
 * Atomically increment sessions_remaining for a mentorship
 * Uses PostgreSQL stored function for truly atomic operations
 */
export async function atomicallyIncrementMentorshipSessions(
  mentorshipId: string,
  sessionsToAdd: number
): Promise<{ success: boolean; error?: any; newSessionsRemaining?: number }> {
  try {
    // Use PostgreSQL RPC function for atomic operation
    const { data, error } = await supabase.rpc('increment_mentorship_sessions', {
      p_mentorship_id: mentorshipId,
      p_sessions_to_add: sessionsToAdd,
    });

    if (error) {
      logger.error('Atomic increment failed', error instanceof Error ? error : new Error(String(error)), {
        mentorshipId,
        sessionsToAdd,
      });
      return { success: false, error };
    }

    if (!data || data.length === 0 || !data[0].success) {
      return { success: false, error: 'Mentorship not found or operation failed' };
    }

    return {
      success: true,
      newSessionsRemaining: data[0].new_sessions_remaining,
    };
  } catch (error) {
    logger.error('Exception in atomicallyIncrementMentorshipSessions', error instanceof Error ? error : new Error(String(error)), {
      mentorshipId,
      sessionsToAdd,
    });
    return { success: false, error };
  }
}

/**
 * Atomically upsert mentorship with session increment
 * Uses PostgreSQL stored function for truly atomic create-or-increment operation
 */
export async function atomicallyUpsertMentorship(params: {
  menteeId: string;
  instructorId: string;
  sessionsToAdd: number;
  roleName?: string;
}): Promise<{ success: boolean; mentorshipId?: string; error?: any }> {
  const { menteeId, instructorId, sessionsToAdd, roleName } = params;

  try {
    // Use PostgreSQL RPC function for atomic upsert
    const { data, error } = await supabase.rpc('upsert_mentorship_sessions', {
      p_mentee_id: menteeId,
      p_instructor_id: instructorId,
      p_sessions_to_add: sessionsToAdd,
      p_role_name: roleName || '1-on-1 Mentee',
    });

    if (error) {
      logger.error('Atomic upsert failed', error instanceof Error ? error : new Error(String(error)), {
        menteeId,
        instructorId,
        sessionsToAdd,
      });
      return { success: false, error };
    }

    if (!data || data.length === 0 || !data[0].success) {
      return { success: false, error: 'Failed to upsert mentorship' };
    }

    return {
      success: true,
      mentorshipId: data[0].mentorship_id,
    };
  } catch (error) {
    logger.error('Exception in atomicallyUpsertMentorship', error instanceof Error ? error : new Error(String(error)), {
      menteeId,
      instructorId,
      sessionsToAdd,
    });
    return { success: false, error };
  }
}

/**
 * Atomically check and mark webhook as processed using transaction_id
 * Uses atomic INSERT with ON CONFLICT to eliminate race conditions
 * Returns true if this webhook should be processed, false if already processed
 * 
 * This function uses an "insert-first" pattern: it attempts to insert a purchase
 * record immediately. If the insert succeeds, this is the first webhook and should
 * be processed. If it fails due to unique constraint violation, the webhook was
 * already processed.
 */
export async function checkAndMarkWebhookProcessed(
  transactionId: string | number | null,
  email: string,
  offerId: string,
  instructorId: string,
  offerPrice?: string | number | null,
  currency?: string | null
): Promise<{ shouldProcess: boolean; alreadyProcessed: boolean }> {
  if (!transactionId) {
    // Without transaction ID, we can't deduplicate - process it
    return { shouldProcess: true, alreadyProcessed: false };
  }

  try {
    const transactionIdString = String(transactionId);
    
    // Atomic insert-first pattern: attempt to insert the purchase record
    // This is atomic at the database level, eliminating the race condition
    const { data: insertedPurchase, error: insertError } = await supabase
      .from('purchases')
      .insert({
        email: email.toLowerCase(),
        instructor_id: instructorId,
        offer_id: offerId,
        transaction_id: transactionIdString,
        amount_paid_decimal: offerPrice != null ? Number(offerPrice) : null,
        currency: currency ?? null,
        purchased_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    // Check if the insert succeeded
    if (insertError) {
      // Check if error is due to unique constraint violation (transaction_id already exists)
      // Supabase/PostgREST may return errors in different formats:
      // - PostgreSQL error code '23505' (unique_violation)
      // - PostgREST error code 'PGRST301' or similar
      // - Error message containing 'unique', 'duplicate', or constraint name
      const errorCode = (insertError as any).code;
      const errorMessage = String((insertError as any).message || '').toLowerCase();
      const errorDetails = String((insertError as any).details || '').toLowerCase();
      const errorHint = String((insertError as any).hint || '').toLowerCase();
      const allErrorText = `${errorMessage} ${errorDetails} ${errorHint}`;
      
      // Check for unique constraint violation indicators
      const isUniqueViolation = 
        errorCode === '23505' || // PostgreSQL unique_violation
        errorCode === 'PGRST301' || // PostgREST unique violation (if used)
        allErrorText.includes('unique') ||
        allErrorText.includes('duplicate') ||
        allErrorText.includes('already exists') ||
        allErrorText.includes('idx_purchases_transaction_id_unique'); // Our specific constraint name
      
      if (isUniqueViolation) {
        // Unique constraint violation - purchase already exists, webhook was already processed
        logger.debug('Webhook already processed (duplicate transaction_id)', { transactionId: transactionIdString });
        return { shouldProcess: false, alreadyProcessed: true };
      }
      
      // Other database error - log and process to avoid missing legitimate webhooks
      logger.error('Error in atomic webhook deduplication insert', insertError instanceof Error ? insertError : new Error(String(insertError)), {
        transactionId: transactionIdString,
        email,
      });
      return { shouldProcess: true, alreadyProcessed: false };
    }

    // Insert succeeded - this is the first webhook for this transaction
    if (insertedPurchase) {
      return { shouldProcess: true, alreadyProcessed: false };
    }

    // Insert returned no data but no error - this shouldn't happen, but process it
    logger.warn('Atomic insert returned no data but no error for transaction', {
      transactionId: transactionIdString,
    });
    return { shouldProcess: true, alreadyProcessed: false };
  } catch (error) {
    logger.error('Exception in atomic webhook deduplication', error instanceof Error ? error : new Error(String(error)), {
      transactionId: String(transactionId),
      email,
    });
    // On error, process it to avoid missing legitimate webhooks
    return { shouldProcess: true, alreadyProcessed: false };
  }
}

