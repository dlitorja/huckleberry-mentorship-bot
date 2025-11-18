#!/bin/bash
# Test script for video call APIs
# Usage: ./scripts/test-video-call-apis.sh [base_url] [mentorship_id]

BASE_URL="${1:-http://localhost:3000}"
MENTORSHIP_ID="${2}"

if [ -z "$MENTORSHIP_ID" ]; then
    echo "Usage: $0 [base_url] [mentorship_id]"
    echo "Example: $0 http://localhost:3000 abc123-def456-ghi789"
    echo ""
    echo "Note: You need to be logged in (have a valid session cookie) to test these APIs."
    echo "The mentorship_id should be a valid UUID from your mentorships table."
    exit 1
fi

echo "Testing Video Call APIs"
echo "======================"
echo "Base URL: $BASE_URL"
echo "Mentorship ID: $MENTORSHIP_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Note: These tests require authentication. Make sure you're logged in first.${NC}"
echo ""

# Test 1: Generate Token
echo "1. Testing POST /api/video-call/token"
echo "-----------------------------------"
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/video-call/token" \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat ~/.next-auth-session 2>/dev/null || echo '')" \
  -d "{\"mentorshipId\": \"$MENTORSHIP_ID\"}" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$TOKEN_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$TOKEN_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Token generated successfully${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    TOKEN=$(echo "$BODY" | jq -r '.token' 2>/dev/null)
    APP_ID=$(echo "$BODY" | jq -r '.appId' 2>/dev/null)
    CHANNEL_NAME=$(echo "$BODY" | jq -r '.channelName' 2>/dev/null)
    ROLE=$(echo "$BODY" | jq -r '.role' 2>/dev/null)
    echo ""
    echo "Token: ${TOKEN:0:50}..."
    echo "App ID: $APP_ID"
    echo "Channel: $CHANNEL_NAME"
    echo "Role: $ROLE"
else
    echo -e "${RED}✗ Failed to generate token (HTTP $HTTP_STATUS)${NC}"
    echo "$BODY"
fi
echo ""

# Test 2: Start Call
echo "2. Testing POST /api/video-call/start"
echo "-----------------------------------"
START_RESPONSE=$(curl -s -X POST "$BASE_URL/api/video-call/start" \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat ~/.next-auth-session 2>/dev/null || echo '')" \
  -d "{\"mentorshipId\": \"$MENTORSHIP_ID\"}" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$START_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$START_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Call started successfully${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    CALL_ID=$(echo "$BODY" | jq -r '.callId' 2>/dev/null)
    echo ""
    echo "Call ID: $CALL_ID"
    echo ""
    echo -e "${YELLOW}Waiting 2 seconds before ending call...${NC}"
    sleep 2
else
    echo -e "${RED}✗ Failed to start call (HTTP $HTTP_STATUS)${NC}"
    echo "$BODY"
    CALL_ID=""
fi
echo ""

# Test 3: End Call (if we have a call ID)
if [ -n "$CALL_ID" ] && [ "$CALL_ID" != "null" ]; then
    echo "3. Testing POST /api/video-call/end"
    echo "-----------------------------------"
    END_RESPONSE=$(curl -s -X POST "$BASE_URL/api/video-call/end" \
      -H "Content-Type: application/json" \
      -H "Cookie: $(cat ~/.next-auth-session 2>/dev/null || echo '')" \
      -d "{\"callId\": \"$CALL_ID\"}" \
      -w "\nHTTP_STATUS:%{http_code}")

    HTTP_STATUS=$(echo "$END_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    BODY=$(echo "$END_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ Call ended successfully${NC}"
        echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    else
        echo -e "${RED}✗ Failed to end call (HTTP $HTTP_STATUS)${NC}"
        echo "$BODY"
    fi
else
    echo "3. Skipping POST /api/video-call/end (no call ID)"
fi
echo ""

# Test 4: Get Call History
echo "4. Testing GET /api/video-call/history"
echo "-----------------------------------"
HISTORY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/video-call/history?mentorshipId=$MENTORSHIP_ID" \
  -H "Cookie: $(cat ~/.next-auth-session 2>/dev/null || echo '')" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$HISTORY_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$HISTORY_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Call history retrieved successfully${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    CALL_COUNT=$(echo "$BODY" | jq -r '.calls | length' 2>/dev/null || echo "0")
    echo ""
    echo "Total calls: $CALL_COUNT"
else
    echo -e "${RED}✗ Failed to get call history (HTTP $HTTP_STATUS)${NC}"
    echo "$BODY"
fi
echo ""

echo "Testing complete!"
echo ""
echo -e "${YELLOW}Note: For manual testing with browser authentication:${NC}"
echo "1. Open browser DevTools (F12)"
echo "2. Go to Application/Storage > Cookies"
echo "3. Copy the session cookie value"
echo "4. Use it in curl: curl -H 'Cookie: next-auth.session-token=YOUR_COOKIE' ..."

