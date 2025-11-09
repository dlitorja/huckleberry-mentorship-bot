// test-webhook.js
// Simple script to test the webhook endpoint locally

import fetch from 'node-fetch';

const testPayload = {
  email: 'test@example.com',
  offer_id: '2150278952' // Use one of your actual offer IDs
};

console.log('Sending test webhook to http://localhost:3000/webhook/kajabi');
console.log('Payload:', JSON.stringify(testPayload, null, 2));

try {
  const response = await fetch('http://localhost:3000/webhook/kajabi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPayload),
  });

  const data = await response.json();
  console.log('\nResponse Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('\n✅ Success! Check your email (test@example.com) for the Discord invite.');
  } else {
    console.log('\n❌ Error occurred. Check the webhook server logs.');
  }
} catch (error) {
  console.error('Request failed:', error);
}

