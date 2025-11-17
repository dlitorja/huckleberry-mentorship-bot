import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  atomicallyIncrementMentorshipSessions,
  atomicallyUpsertMentorship,
  checkAndMarkWebhookProcessed,
} from '../../databaseTransactions.js';
// Mock Supabase client
jest.mock('../../../bot/supabaseClient.js');

import { supabase } from '../../../bot/supabaseClient.js';

// Cast to any to access mock properties, then set up the mocks
const mockSupabase = supabase as any;
mockSupabase.rpc = jest.fn();
mockSupabase.from = jest.fn();

// Mock logger
jest.mock('../../logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('databaseTransactions - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure mocks are reset
    (mockSupabase.rpc as jest.MockedFunction<any>).mockReset();
    (mockSupabase.from as jest.MockedFunction<any>).mockReset();
  });

  describe('atomicallyIncrementMentorshipSessions', () => {
    it('should successfully increment sessions', async () => {
      const mockResponse = {
        data: [{ success: true, new_sessions_remaining: 5 }],
        error: null,
      };

      (mockSupabase.rpc as jest.MockedFunction<any>).mockResolvedValueOnce(mockResponse);

      const result = await atomicallyIncrementMentorshipSessions('mentorship-id', 2);

      expect(result.success).toBe(true);
      expect(result.newSessionsRemaining).toBe(5);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_mentorship_sessions', {
        p_mentorship_id: 'mentorship-id',
        p_sessions_to_add: 2,
      });
    });

    it('should handle RPC errors', async () => {
      const mockError = { message: 'Database error', code: 'PGRST301' };
      (mockSupabase.rpc as jest.MockedFunction<any>).mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      const result = await atomicallyIncrementMentorshipSessions('mentorship-id', 2);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should handle operation failure', async () => {
      (mockSupabase.rpc as jest.MockedFunction<any>).mockResolvedValueOnce({
        data: [{ success: false }],
        error: null,
      });

      const result = await atomicallyIncrementMentorshipSessions('mentorship-id', 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mentorship not found or operation failed');
    });
  });

  describe('atomicallyUpsertMentorship', () => {
    it('should successfully upsert mentorship', async () => {
      const mockResponse = {
        data: [{ success: true, mentorship_id: 'new-mentorship-id' }],
        error: null,
      };

      (mockSupabase.rpc as jest.MockedFunction<any>).mockResolvedValueOnce(mockResponse);

      const result = await atomicallyUpsertMentorship({
        menteeId: 'mentee-id',
        instructorId: 'instructor-id',
        sessionsToAdd: 4,
        roleName: '1-on-1 Mentee',
      });

      expect(result.success).toBe(true);
      expect(result.mentorshipId).toBe('new-mentorship-id');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_mentorship_sessions', {
        p_mentee_id: 'mentee-id',
        p_instructor_id: 'instructor-id',
        p_sessions_to_add: 4,
        p_role_name: '1-on-1 Mentee',
      });
    });

    it('should use default role name when not provided', async () => {
      const mockResponse = {
        data: [{ success: true, mentorship_id: 'new-mentorship-id' }],
        error: null,
      };

      (mockSupabase.rpc as jest.MockedFunction<any>).mockResolvedValueOnce(mockResponse);

      await atomicallyUpsertMentorship({
        menteeId: 'mentee-id',
        instructorId: 'instructor-id',
        sessionsToAdd: 4,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_mentorship_sessions', {
        p_mentee_id: 'mentee-id',
        p_instructor_id: 'instructor-id',
        p_sessions_to_add: 4,
        p_role_name: '1-on-1 Mentee',
      });
    });

    it('should handle upsert failure', async () => {
      (mockSupabase.rpc as jest.MockedFunction<any>).mockResolvedValueOnce({
        data: [{ success: false }],
        error: null,
      });

      const result = await atomicallyUpsertMentorship({
        menteeId: 'mentee-id',
        instructorId: 'instructor-id',
        sessionsToAdd: 4,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to upsert mentorship');
    });
  });

  describe('checkAndMarkWebhookProcessed', () => {
    it('should return shouldProcess=true when transaction_id is null', async () => {
      const result = await checkAndMarkWebhookProcessed(
        null,
        'test@example.com',
        'offer-id',
        'instructor-id'
      );

      expect(result.shouldProcess).toBe(true);
      expect(result.alreadyProcessed).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should insert purchase and return shouldProcess=true for new transaction', async () => {
      const mockMaybeSingle = jest.fn<() => Promise<{ data: { id: string } | null; error: any | null }>>().mockResolvedValue({
        data: { id: 'purchase-id' },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue({
        insert: mockInsert,
      });

      const result = await checkAndMarkWebhookProcessed(
        'transaction-123',
        'test@example.com',
        'offer-id',
        'instructor-id',
        100,
        'USD'
      );

      expect(result.shouldProcess).toBe(true);
      expect(result.alreadyProcessed).toBe(false);
      expect(mockInsert).toHaveBeenCalledWith({
        email: 'test@example.com',
        instructor_id: 'instructor-id',
        offer_id: 'offer-id',
        transaction_id: 'transaction-123',
        amount_paid_decimal: 100,
        currency: 'USD',
        purchased_at: expect.any(String),
      });
    });

    it('should detect duplicate transaction and return alreadyProcessed=true', async () => {
      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: null,
        error: {
          code: '23505', // PostgreSQL unique violation
          message: 'duplicate key value violates unique constraint',
        },
      });
      const mockSelect = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue({
        insert: mockInsert,
      });

      const result = await checkAndMarkWebhookProcessed(
        'transaction-123',
        'test@example.com',
        'offer-id',
        'instructor-id'
      );

      expect(result.shouldProcess).toBe(false);
      expect(result.alreadyProcessed).toBe(true);
    });

    it('should handle non-unique constraint errors as new transactions', async () => {
      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: null,
        error: {
          code: 'PGRST302', // Different error code (not a unique violation)
          message: 'Some other database error',
        },
      });
      const mockSelect = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });
      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue({
        insert: mockInsert,
      });

      const result = await checkAndMarkWebhookProcessed(
        'transaction-123',
        'test@example.com',
        'offer-id',
        'instructor-id'
      );

      // Non-unique errors should still process (might be transient error)
      expect(result.shouldProcess).toBe(true);
      expect(result.alreadyProcessed).toBe(false);
    });
  });
});

