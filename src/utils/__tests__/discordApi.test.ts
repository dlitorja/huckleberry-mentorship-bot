import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { discordApi } from '../discordApi.js';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock logger to avoid console output during tests
jest.mock('../logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock environment variables
const originalEnv = process.env;

// Helper to create mock headers that work correctly with Headers.get()
function createMockHeaders(headers: Record<string, string>): Headers {
  const mockHeaders = {
    get: (name: string) => {
      // Headers.get() is case-insensitive
      const lowerName = name.toLowerCase();
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerName) {
          return value;
        }
      }
      return null;
    },
  } as Headers;
  return mockHeaders;
}

describe('discordApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      DISCORD_BOT_TOKEN: 'test-bot-token',
      DISCORD_GUILD_ID: '123456789012345678',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getOrCreateDMChannel', () => {
    it('should return channel ID on success', async () => {
      const mockChannel = { id: '987654321098765432' };
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          'x-ratelimit-limit': '50',
          'content-type': 'application/json',
        }),
        json: async () => mockChannel,
        text: async () => JSON.stringify(mockChannel),
      } as unknown as Response);

      const result = await discordApi.getOrCreateDMChannel('123456789012345678');
      expect(result).toBe('987654321098765432');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/users/@me/channels',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ recipient_id: '123456789012345678' }),
        })
      );
    });

    it('should return null on failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => 'Not Found',
        json: async () => { throw new Error('Not Found'); },
      } as unknown as Response);

      const result = await discordApi.getOrCreateDMChannel('123456789012345678');
      expect(result).toBeNull();
    });
  });

  describe('sendDM', () => {
    it('should return true on successful DM send', async () => {
      // Mock getOrCreateDMChannel
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: createMockHeaders({
            'x-ratelimit-remaining': '49',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'content-type': 'application/json',
          }),
          json: async () => ({ id: '987654321098765432' }),
          text: async () => JSON.stringify({ id: '987654321098765432' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: createMockHeaders({
            'x-ratelimit-remaining': '48',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
            'content-type': 'application/json',
          }),
          json: async () => ({}),
          text: async () => '{}',
        } as unknown as Response);

      const result = await discordApi.sendDM('123456789012345678', 'Hello!');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return false if channel creation fails', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => 'Not Found',
        json: async () => { throw new Error('Not Found'); },
      } as unknown as Response);

      const result = await discordApi.sendDM('123456789012345678', 'Hello!');
      expect(result).toBe(false);
    });
  });

  describe('getGuildRoles', () => {
    it('should return array of roles with id and name', async () => {
      const mockRoles = [
        { id: '111111111111111111', name: 'Role 1' },
        { id: '222222222222222222', name: 'Role 2' },
        { id: null, name: 'Invalid Role' }, // Should be filtered out
      ];

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          'content-type': 'application/json',
        }),
        json: async () => mockRoles,
        text: async () => JSON.stringify(mockRoles),
      } as unknown as Response);

      const result = await discordApi.getGuildRoles();
      expect(result).toEqual([
        { id: '111111111111111111', name: 'Role 1' },
        { id: '222222222222222222', name: 'Role 2' },
      ]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/guilds/'),
        expect.any(Object)
      );
    });

    it('should return empty array on failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Discord API error (500): Internal Server Error')
      );

      const result = await discordApi.getGuildRoles();
      expect(result).toEqual([]);
    });
  });

  describe('findRoleByName', () => {
    it('should return role ID when role exists', async () => {
      const mockRoles = [
        { id: '111111111111111111', name: 'Admin' },
        { id: '222222222222222222', name: 'Member' },
      ];

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          'content-type': 'application/json',
        }),
        json: async () => mockRoles,
        text: async () => JSON.stringify(mockRoles),
      } as unknown as Response);

      const result = await discordApi.findRoleByName('Admin');
      expect(result).toBe('111111111111111111');
    });

    it('should return null when role does not exist', async () => {
      const mockRoles = [
        { id: '111111111111111111', name: 'Admin' },
        { id: '222222222222222222', name: 'Member' },
      ];

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          'content-type': 'application/json',
        }),
        json: async () => mockRoles,
        text: async () => JSON.stringify(mockRoles),
      } as unknown as Response);

      const result = await discordApi.findRoleByName('NonExistent');
      expect(result).toBeNull();
    });
  });

  describe('addRoleToMember', () => {
    it('should return true on success', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        }),
        json: async () => ({}),
        text: async () => '',
      } as unknown as Response);

      const result = await discordApi.addRoleToMember('123456789012345678', '111111111111111111');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/guilds/'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should return false on failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Discord API error (404): Not Found')
      );

      const result = await discordApi.addRoleToMember('123456789012345678', '111111111111111111');
      expect(result).toBe(false);
    });
  });

  describe('removeRoleFromMember', () => {
    it('should return true on success', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        }),
        json: async () => ({}),
        text: async () => '',
      } as unknown as Response);

      const result = await discordApi.removeRoleFromMember('123456789012345678', '111111111111111111');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/guilds/'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should return false on failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Discord API error (404): Not Found')
      );

      const result = await discordApi.removeRoleFromMember('123456789012345678', '111111111111111111');
      expect(result).toBe(false);
    });
  });

  describe('getGuildMember', () => {
    it('should return member data on success', async () => {
      const mockMember = { id: '123456789012345678', username: 'testuser' };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          'content-type': 'application/json',
        }),
        json: async () => mockMember,
        text: async () => JSON.stringify(mockMember),
      } as unknown as Response);

      const result = await discordApi.getGuildMember('123456789012345678');
      expect(result).toEqual(mockMember);
    });

    it('should return null on failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Discord API error (404): Not Found')
      );

      const result = await discordApi.getGuildMember('123456789012345678');
      expect(result).toBeNull();
    });
  });

  describe('addGuildMember', () => {
    it('should return true on success', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        }),
        json: async () => ({}),
        text: async () => '{}',
      } as unknown as Response);

      const result = await discordApi.addGuildMember('123456789012345678', 'access-token');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/guilds/'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ access_token: 'access-token' }),
        })
      );
    });

    it('should return false on failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Discord API error (400): Bad Request')
      );

      const result = await discordApi.addGuildMember('123456789012345678', 'access-token');
      expect(result).toBe(false);
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should return token data on success', async () => {
      const mockToken = {
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        scope: 'identify guilds.join',
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({
          'content-type': 'application/json',
        }),
        json: async () => mockToken,
        text: async () => JSON.stringify(mockToken),
      } as unknown as Response);

      const result = await discordApi.exchangeCodeForToken('code', 'http://localhost/callback');
      expect(result).toEqual(mockToken);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should return null on failure', async () => {
      // Mock the fetch call that exchangeCodeForToken makes directly
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers(),
        text: async () => 'Invalid code',
        json: async () => { throw new Error('Invalid code'); },
      } as unknown as Response);

      const result = await discordApi.exchangeCodeForToken('invalid-code', 'http://localhost/callback');
      expect(result).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user data on success', async () => {
      const mockUser = { id: '123456789012345678', username: 'testuser' };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: createMockHeaders({
          'x-ratelimit-remaining': '49',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          'content-type': 'application/json',
        }),
        json: async () => mockUser,
        text: async () => JSON.stringify(mockUser),
      } as unknown as Response);

      const result = await discordApi.getCurrentUser('access-token');
      expect(result).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/users/@me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        })
      );
    });

    it('should return null on failure', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Discord API error (401): Unauthorized')
      );

      const result = await discordApi.getCurrentUser('invalid-token');
      expect(result).toBeNull();
    });
  });
});

