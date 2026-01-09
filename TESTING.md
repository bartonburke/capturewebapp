# iOS Device Testing Guide

## Prerequisites

1. **Node.js Version**: Upgrade to Node.js 20.9.0 or higher
   ```bash
   # Check current version
   node --version

   # If < 20.9.0, install newer version:
   # Option 1: Using nvm (recommended)
   nvm install 20
   nvm use 20

   # Option 2: Using Homebrew
   brew install node@20
   ```

2. **Same WiFi Network**: Ensure your iPhone and development machine are on the same WiFi network

## Setup Steps

### 1. Start the Development Server

```bash
cd /Users/bdennysturfee/testai/CCodeWork/Prototypes/capturewebapp
npm run dev
```

The server will start on `http://localhost:3000`

### 2. Access from iPhone

Your local IP address is: **192.168.7.213**

On your iPhone Safari, navigate to:
```
http://192.168.7.213:3000
```

### 3. Camera Access

**Important**: iOS Safari requires HTTPS for camera access, but there's a workaround for local development:

#### Option A: Use localhost tunnel (Recommended)
Use a service like ngrok to create an HTTPS tunnel:

```bash
# Install ngrok
brew install ngrok

# Start tunnel
ngrok http 3000
```

Then use the HTTPS URL provided by ngrok on your iPhone.

#### Option B: Enable camera for HTTP (Development Only)
On iOS Safari:
1. Go to Settings > Safari > Advanced > Experimental Features
2. Look for "Disable Media Capture Restriction" or similar
3. Note: This option may not be available on all iOS versions

### 4. Add to Home Screen (PWA)

Once the app loads in Safari:
1. Tap the Share button (square with arrow)
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add"
4. The app icon will appear on your home screen

Launch from the home screen to use it in standalone mode (without Safari UI).

## Testing Checklist

### Basic Functionality
- [ ] App loads without errors
- [ ] Full-screen display works (no Safari chrome)
- [ ] Camera preview displays (rear camera)
- [ ] "Start Session" button works
- [ ] Timer starts counting
- [ ] Status changes to "Recording" with red pulsing indicator

### Photo Capture
- [ ] Tap circular capture button
- [ ] White flash appears briefly
- [ ] Photo count increments
- [ ] No lag or freezing

### Session Controls
- [ ] Pause button pauses timer
- [ ] Camera button is disabled when paused
- [ ] Resume button resumes timer
- [ ] Camera button re-enables after resume
- [ ] End Session stops everything

### Mobile Optimizations
- [ ] No rubber-band scrolling
- [ ] No pull-to-refresh
- [ ] Safe area insets work (notch, home indicator)
- [ ] No accidental zooming
- [ ] Touch targets are appropriately sized

### Performance
- [ ] Camera preview is smooth (no stuttering)
- [ ] Timer updates accurately
- [ ] No memory leaks during long sessions
- [ ] App stays responsive

## Known Issues / Expected Behavior

1. **Camera on Desktop**: Desktop browsers may show front camera or no camera. This is normal - rear camera works correctly on iOS devices.

2. **HTTPS Requirement**: Camera access requires HTTPS. Use ngrok or another tunneling service for full functionality.

3. **No Persistence Yet**: Photos are captured but not saved to storage. This will be implemented in the next phase.

4. **No Audio Recording Yet**: Continuous audio recording will be added in the next phase.

## Troubleshooting

### Camera doesn't work
- Ensure you're using HTTPS (via ngrok) or have enabled camera for HTTP in Safari settings
- Check that camera permissions are granted in Settings > Safari > Camera

### Can't connect to IP address
- Verify both devices are on the same WiFi network
- Check that no firewall is blocking port 3000
- Try accessing `http://192.168.7.213:3000` in Safari (not other browsers)

### App won't add to home screen
- Make sure you're in Safari (not Chrome or other browsers)
- Verify manifest.json is accessible at `http://192.168.7.213:3000/manifest.json`

### Black screen instead of camera
- This is likely due to HTTP vs HTTPS. Use ngrok to get HTTPS URL.
- Check browser console for errors

## Next Steps After Testing

Once basic functionality is confirmed:
1. Implement GPS tagging for photos
2. Add continuous audio recording
3. Implement IndexedDB storage for session data
4. Build review/gallery interface
5. Add post-processing pipeline (Whisper + Claude)

## Quick Start Command

```bash
# One-liner to start dev server with ngrok
npm run dev & ngrok http 3000
```

Then use the ngrok HTTPS URL on your iPhone.
