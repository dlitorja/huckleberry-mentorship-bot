# Quick Start: Video Call APIs

## Step 1: Run Database Migration

**The 500 errors are because the `video_calls` table doesn't exist yet.**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database/add_video_calls.sql`
4. Click **Run**

This will create the `video_calls` table and all necessary indexes.

## Step 2: (Optional) Set Agora Credentials

The 503 error for `/api/video-call/token` is expected if Agora isn't configured yet.

To test token generation, add to your `.env` file:
```env
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate
```

**Note:** You can test the start/end/history APIs without Agora credentials. Only the token API requires them.

## Step 3: Test the APIs

After running the migration:

1. **Test Start Call** - Should work now (creates database record)
2. **Test End Call** - Should work now (updates database record)
3. **Test History** - Should work now (reads from database)
4. **Test Token** - Will still show 503 until Agora credentials are set

## Verification

After running the migration, verify in Supabase:

```sql
-- Check if table exists
SELECT * FROM video_calls LIMIT 1;

-- Should return empty result (no error means table exists)
```

## Troubleshooting

### Still getting 500 errors after migration?
- Check Supabase logs for the exact error
- Verify the migration ran successfully
- Make sure you're using the correct database

### Getting permission errors?
- Ensure your Supabase service role key has proper permissions
- Check that the `video_calls` table is accessible

