// Mock Resend client for testing

import { jest } from '@jest/globals';

export interface MockResendEmailResponse {
  id: string;
}

export class MockResend {
  emails = {
    send: jest.fn<() => Promise<{ data: MockResendEmailResponse | null; error: any | null }>>(),
  };

  constructor(apiKey?: string) {
    // Mock constructor accepts apiKey but doesn't need it for testing
  }

  // Set default successful response
  setDefaultSuccess(emailId: string = 'mock-email-id') {
    this.emails.send.mockResolvedValue({
      data: { id: emailId },
      error: null,
    });
  }

  // Set default error response
  setDefaultError(error: any) {
    this.emails.send.mockResolvedValue({
      data: null,
      error,
    });
  }

  // Reset mock
  reset() {
    this.emails.send.mockReset();
    this.setDefaultSuccess();
  }
}

// Export mock as default
export default MockResend;

