# Troubleshooting Guide

## Common Issues

### "Sign in to confirm you're not a bot"

**Symptoms:**
- Error: `youtube_bot_detection`
- Message: "YouTube has detected automated access and is requiring sign-in"

**Cause:**
YouTube has detected that requests are coming from yt-dlp and is blocking them with bot detection.

**Solutions (try in order):**

1. **Wait and retry** - The block is often temporary (5-15 minutes)

2. **Restart your dev server** - Gets a fresh connection

3. **Try a different video** - Some videos trigger bot detection more than others

4. **Use a VPN** - Your IP may be rate-limited by YouTube

5. **Update yt-dlp** - Newer versions have better bot avoidance:
   ```bash
   pip install -U yt-dlp
   ```

**What we already do to avoid this:**
- Use `--impersonate chrome` with `curl_cffi` for TLS/HTTP fingerprint mimicking
- Skip unnecessary webpage extraction
- Use retry logic for transient failures

**Requirements:** `pip install curl_cffi`

### HTTP 403 Forbidden from YouTube

**Symptoms:**
- Error message: `HTTP Error 403: Forbidden`
- Log shows: `YouTube is forcing SABR streaming for this client`

**Cause:**
YouTube is blocking certain client types or your IP.

**Solution:**
The app uses iOS client by default which typically avoids this. If you still get 403:
1. Update yt-dlp: `pip install -U yt-dlp`
2. Try a different network/VPN
3. Wait a few minutes (rate limiting is temporary)

### Next.js Cross-Origin Warning

**Symptoms:**
```
⚠ Cross origin request detected from 192.168.1.29 to /_next/* resource.
```

**Solution:**
Already fixed in `next.config.ts`. If you're accessing from a different IP, add it:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "192.168.1.29",  // Add your IP here
    "127.0.0.1",
  ],
};
```

### "Download failed" without details

**Symptoms:**
- Generic error message
- No helpful information

**Solution:**
Error handling now includes specific codes:
- `youtube_bot_detection` - See "Sign in to confirm you're not a bot" above
- `youtube_access_denied` - 403 error, try different network
- `video_not_found` - Video private/deleted
- `network_error` - Connection issues
- `download_validation_failed` - File corrupted

Check the browser console for the full error object with `code`, `message`, and `details`.

### FFmpeg trim fails

**Symptoms:**
- Download succeeds but trim fails
- Error: `trim_failed`

**Possible causes:**
1. **Corrupted download**: File validation now checks this
2. **FFmpeg not installed**: Verify with `ffmpeg -version`
3. **Invalid time range**: App validates this before processing

### Network errors / timeout

**Symptoms:**
- Error: `network_error`
- Download hangs

**Solutions:**
1. Check internet connection
2. Some videos are region-restricted - try a different one
3. Check proxy/VPN settings

## Diagnostic Tool

Run the diagnostic tool to check your setup:

```bash
npm run diagnose
```

This verifies:
- yt-dlp and FFmpeg installations
- Temp directory writability
- YouTube metadata fetching
- YouTube download capability

## Updating yt-dlp

**Critical:** Keep yt-dlp updated as YouTube changes frequently:

```bash
# pip
pip install -U yt-dlp

# apt (Ubuntu/Debian)
sudo apt update && sudo apt upgrade yt-dlp

# Or download latest binary:
# https://github.com/yt-dlp/yt-dlp/releases
```

## Rate Limiting & IP Blocks

YouTube aggressively rate-limits IPs that make many requests. If you see bot detection:

1. **Development**: Wait 5-15 minutes between attempts
2. **Production**: Implement request caching and rate limiting
3. **Persistent issues**: Use rotating proxies (advanced)

## Still having issues?

1. Check yt-dlp issues: https://github.com/yt-dlp/yt-dlp/issues
2. Search for "bot" or "sign in" in their issues
3. Run diagnostics: `npm run diagnose`
4. Check full error logs in terminal
