# SOC Analyst Personal Assistant - Implementation Plan

## Project Structure
- `src/SOCAssistant.jsx` - SOC-focused AI chatbot component
- `server/` - Backend server for email + news
  - `server/index.js` - Express server entry
  - `server/emailService.js` - Gmail API integration
  - `server/newsService.js` - Fetch latest SOC/cybersecurity news
  - `server/cronJobs.js` - Daily scheduled email tasks
- Updates to `src/App.jsx` - Add SOC Assistant tab
- `.env` updates - Add server config + Gmail tokens

## Implementation Steps
- [ ] Install dependencies: googleapis, node-cron, axios, google-auth-library
- [ ] Create `server/index.js` - Express server with routes
- [ ] Create `server/emailService.js` - Gmail API email sender
- [ ] Create `server/newsService.js` - Fetch SOC/cybersecurity news
- [ ] Create `server/cronJobs.js` - Daily news email scheduler
- [ ] Create `src/SOCAssistant.jsx` - SOC chatbot component with OpenRouter
- [ ] Update `src/App.jsx` - Add SOC Assistant tab to navigation
- [ ] Update `.env` - Add server environment variables
- [ ] Update `package.json` - Add server start script
- [ ] Test the full integration