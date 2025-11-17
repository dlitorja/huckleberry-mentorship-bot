// Mock Supabase client for testing
// This provides a mock implementation that can be used in tests

import { jest } from '@jest/globals';

export interface MockSupabaseResponse<T> {
  data: T | null;
  error: any | null;
}

export interface MockSupabaseQuery {
  select: jest.MockedFunction<any>;
  from: jest.MockedFunction<any>;
  eq: jest.MockedFunction<any>;
  neq: jest.MockedFunction<any>;
  gt: jest.MockedFunction<any>;
  gte: jest.MockedFunction<any>;
  lt: jest.MockedFunction<any>;
  lte: jest.MockedFunction<any>;
  like: jest.MockedFunction<any>;
  ilike: jest.MockedFunction<any>;
  is: jest.MockedFunction<any>;
  in: jest.MockedFunction<any>;
  contains: jest.MockedFunction<any>;
  order: jest.MockedFunction<any>;
  limit: jest.MockedFunction<any>;
  single: jest.MockedFunction<any>;
  maybeSingle: jest.MockedFunction<any>;
  insert: jest.MockedFunction<any>;
  update: jest.MockedFunction<any>;
  upsert: jest.MockedFunction<any>;
  delete: jest.MockedFunction<any>;
  rpc: jest.MockedFunction<any>;
}

export class MockSupabaseClient {
  public queryChain: MockSupabaseQuery;
  private responses: Map<string, any> = new Map();

  constructor() {
    this.queryChain = this.createQueryChain();
  }

  private createQueryChain(): MockSupabaseQuery {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    };

    return chain;
  }

  from(table: string) {
    return this.queryChain;
  }

  rpc(functionName: string, params?: any) {
    return this.queryChain.rpc(functionName, params);
  }

  // Helper methods for test setup
  setResponse(key: string, response: MockSupabaseResponse<any>) {
    this.responses.set(key, response);
  }

  getResponse(key: string) {
    return this.responses.get(key);
  }

  // Reset all mocks
  reset() {
    this.responses.clear();
    Object.values(this.queryChain).forEach((fn: any) => {
      if (jest.isMockFunction(fn)) {
        fn.mockReset();
      }
    });
  }
}

// Create a factory function that returns a configured mock
export function createMockSupabaseClient() {
  const client = new MockSupabaseClient();
  
  // Set up default chain behavior
  const chain = client.queryChain;
  
  // Make query methods return promises with configurable responses
  chain.single.mockImplementation(async () => {
    return { data: null, error: null };
  });
  
  chain.maybeSingle.mockImplementation(async () => {
    return { data: null, error: null };
  });
  
  chain.insert.mockImplementation(async (data: any) => {
    return { data: [data], error: null };
  });
  
  chain.update.mockImplementation(async (data: any) => {
    return { data: [data], error: null };
  });
  
  chain.upsert.mockImplementation(async (data: any) => {
    return { data: [data], error: null };
  });
  
  chain.delete.mockImplementation(async () => {
    return { data: null, error: null };
  });
  
  chain.rpc.mockImplementation(async () => {
    return { data: null, error: null };
  });

  return client;
}

