import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getMentorshipByDiscordIds,
  getAnyMentorshipForMentee,
} from '../../mentorship.js';
// Mock Supabase client
jest.mock('../../../bot/supabaseClient.js');

import { supabase } from '../../../bot/supabaseClient.js';

// Cast to any to access mock properties, then set up the mock
const mockSupabase = supabase as any;
mockSupabase.from = jest.fn();

describe('mentorship - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure mock is reset
    (mockSupabase.from as jest.MockedFunction<any>).mockReset();
  });

  describe('getMentorshipByDiscordIds', () => {
    it('should fetch mentorship with relations', async () => {
      const mockMentorship = {
        id: 'mentorship-id',
        sessions_remaining: 3,
        total_sessions: 4,
        status: 'active',
        last_session_date: '2024-01-15',
        mentees: {
          id: 'mentee-id',
          email: 'student@example.com',
          discord_id: 'discord-mentee-id',
        },
        instructors: {
          id: 'instructor-id',
          name: 'John Doe',
          discord_id: 'discord-instructor-id',
        },
      };

      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: mockMentorship,
        error: null,
      });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
      };

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue(mockQuery);

      const result = await getMentorshipByDiscordIds({
        instructorDiscordId: 'discord-instructor-id',
        menteeDiscordId: 'discord-mentee-id',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockMentorship);
      expect(mockQuery.eq).toHaveBeenCalledWith('instructors.discord_id', 'discord-instructor-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('mentees.discord_id', 'discord-mentee-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active'); // Default requireActive=true
    });

    it('should filter by status when provided', async () => {
      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
      };

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue(mockQuery);

      await getMentorshipByDiscordIds({
        instructorDiscordId: 'discord-instructor-id',
        menteeDiscordId: 'discord-mentee-id',
        status: 'ended',
      });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'ended');
    });

    it('should not filter by status when requireActive=false', async () => {
      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
      };

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue(mockQuery);

      await getMentorshipByDiscordIds({
        instructorDiscordId: 'discord-instructor-id',
        menteeDiscordId: 'discord-mentee-id',
        requireActive: false,
      });

      // Should not have called eq with 'status', 'active'
      const statusCalls = mockQuery.eq.mock.calls.filter(
        (call: any[]) => call[0] === 'status' && call[1] === 'active'
      );
      expect(statusCalls.length).toBe(0);
    });

    it('should handle database errors', async () => {
      const mockError = { message: 'Database error', code: 'PGRST301' };
      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: null,
        error: mockError,
      });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
      };

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue(mockQuery);

      const result = await getMentorshipByDiscordIds({
        instructorDiscordId: 'discord-instructor-id',
        menteeDiscordId: 'discord-mentee-id',
      });

      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getAnyMentorshipForMentee', () => {
    it('should fetch most recent mentorship for mentee', async () => {
      const mockMentorship = {
        id: 'mentorship-id',
        sessions_remaining: 2,
        total_sessions: 4,
        status: 'active',
        mentees: {
          id: 'mentee-id',
          email: 'student@example.com',
          discord_id: 'discord-mentee-id',
        },
        instructors: {
          id: 'instructor-id',
          name: 'John Doe',
          discord_id: 'discord-instructor-id',
        },
      };

      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: mockMentorship,
        error: null,
      });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
      };

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue(mockQuery);

      const result = await getAnyMentorshipForMentee('discord-mentee-id');

      expect(result.error).toBeNull();
      expect(result.data).toEqual(mockMentorship);
      expect(mockQuery.eq).toHaveBeenCalledWith('mentees.discord_id', 'discord-mentee-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });

    it('should not filter by status when requireActive=false', async () => {
      const mockMaybeSingle = jest.fn<() => Promise<{ data: any | null; error: any | null }>>().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: mockMaybeSingle,
      };

      (mockSupabase.from as jest.MockedFunction<any>).mockReturnValue(mockQuery);

      await getAnyMentorshipForMentee('discord-mentee-id', false);

      const statusCalls = mockQuery.eq.mock.calls.filter(
        (call: any[]) => call[0] === 'status'
      );
      expect(statusCalls.length).toBe(0);
    });
  });
});

