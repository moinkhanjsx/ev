# EV Helper - Manual Testing Guide

## Quick Start
- **Frontend:** http://localhost:5174
- **Backend API:** http://localhost:5000/api
- **Database:** MongoDB (local)

---

## 🧪 MANUAL TEST SCENARIOS

### TEST CASE 1: User Registration & Login
**Objective:** Verify authentication flow works

**Steps:**
1. Go to http://localhost:5174
2. Click "Sign up" link
3. Fill in registration form:
   - Name: "Test User A"
   - Email: "testa@test.com"
   - Password: "Test@123"
   - City: "New York"
4. Click "Sign Up" button
5. Should be redirected to Dashboard
6. Verify you see:
   - Your name in profile
   - Email: "testa@test.com"
   - City: "New York"
   - Token balance (should be non-zero)

**Expected Result:** ✅ Registered and logged in

---

### TEST CASE 2: Create Charging Request
**Objective:** Test request creation and broadcasting

**Prerequisites:** Logged in as Test User A

**Steps:**
1. On Dashboard, click **"Create Charging Request"** (blue button)
2. Fill in form:
   - Location: "123 Main Street, New York"
   - Urgency: "High" (dropdown)
   - Message: "Need urgent EV charging"
   - Contact: "+1-555-1234"
   - Time Available: "2026-01-20 10:00 AM"
3. Click "Submit"
4. Should see success message
5. Request should be stored in database
6. Check **Browser Console** (F12) for Socket.io message:
   - Should see: "Broadcasting request to city room"

**Expected Result:** ✅ Request created and broadcast

---

### TEST CASE 3: View Active Requests (Same User)
**Objective:** Verify user sees their own request

**Prerequisites:** Logged in as Test User A, created a request

**Steps:**
1. On Dashboard, click **"View Active Requests"** (green button)
2. You should see the request you just created
3. Your request should have:
   - Yellow "Your Request" badge
   - NO "Accept" button (only your own requests hide this)
   - Location displayed
   - Urgency icon
   - Contact info

**Expected Result:** ✅ Your request visible with "Your Request" badge

---

### TEST CASE 4: Cross-User Visibility (CASE INSENSITIVE)
**Objective:** Verify requests visible to other users in same city (KEY FIX TEST)

**Steps - Part 1 (Do NOT close the browser tab yet):**
1. Logged in as "Test User A" in New York
2. Created a charging request (Test Case 3)
3. Open **Browser Developer Tools** (F12)
4. Go to **Network** tab
5. Navigate to View Active Requests
6. Look for API call: `GET /api/charging/requests/city/New York`

**Steps - Part 2 (Open Incognito Window):**
1. Open **new INCOGNITO/Private window**
2. Go to http://localhost:5174
3. Click "Sign up"
4. Register new user:
   - Name: "Test User B"
   - Email: "testb@test.com"
   - Password: "Test@123"
   - City: "**new york**" (lowercase - THIS IS THE KEY TEST!)
5. Click "View Active Requests"
6. **CRITICAL CHECK:** Do you see Test User A's request?
   - If YES: ✅ CASE-INSENSITIVE FILTERING WORKS
   - If NO: ❌ BUG: Cities not matching despite fix

**Expected Result:** ✅ Test User B can see Test User A's request

**Why This Matters:** 
- Before fix: "New York" ≠ "new york" (case-sensitive)
- After fix: "New York" = "new york" (case-insensitive)

---

### TEST CASE 5: City Isolation
**Objective:** Verify users in different cities DON'T see each other's requests

**Steps - Part 1:**
1. Keep Test User B logged in (from Test Case 4)
2. Note that they're in "new york" and can see Test User A's request

**Steps - Part 2 (Open Another Incognito Window):**
1. Open **another Incognito window**
2. Go to http://localhost:5174
3. Register new user:
   - Name: "Test User C"
   - Email: "testc@test.com"
   - Password: "Test@123"
   - City: "Toronto" (DIFFERENT city)
4. Click "View Active Requests"
5. **CRITICAL CHECK:** Do you see Test User A's request (from New York)?
   - If YES: ❌ BUG: City isolation not working
   - If NO: ✅ CITY ISOLATION WORKS

**Expected Result:** ✅ Test User C cannot see New York requests

---

### TEST CASE 6: Real-Time Updates (Socket.io)
**Objective:** Verify requests appear in real-time without refresh

**Prerequisites:**
- Window 1: Test User A (New York) - on Dashboard
- Window 2: Test User B (new york) - on "View Active Requests" page

**Steps:**
1. Keep both windows visible
2. In **Window 1**, click "Create Charging Request" again
3. Fill form and submit
4. **Check Window 2 WITHOUT refreshing:**
   - Does the new request appear automatically?
   - Or do you need to refresh?
   - If appears automatically: ✅ REAL-TIME WORKS
   - If needs refresh: ❌ REAL-TIME NOT WORKING

**Expected Result:** ✅ Request appears instantly in Window 2

---

### TEST CASE 7: Accept Request
**Objective:** Test request acceptance workflow

**Prerequisites:**
- Window 1: Test User A (created request)
- Window 2: Test User B (can see request)

**Steps:**
1. In **Window 2**, click "Accept" button on Test User A's request
2. Should see: "Request accepted successfully!"
3. Check that request:
   - Changes status from "OPEN" to "ACCEPTED"
   - Disappears from active list (or shows as accepted)
   - Test User A is notified

**Note:** Accept button should NOT appear on your own requests

**Expected Result:** ✅ Request accepted and status updated

---

### TEST CASE 8: Back Button Navigation
**Objective:** Verify back buttons work on all pages

**Steps:**
1. From Dashboard → "View Active Requests"
2. Click "Back" button (should show)
3. Should return to Dashboard
4. From Dashboard → "Create Charging Request"
5. Click "Back" button
6. Should return to Dashboard

**Expected Result:** ✅ Back buttons work on all child pages

---

### TEST CASE 9: Token/Token System
**Objective:** Verify token display and updates

**Steps:**
1. On Dashboard, look at **"Token Balance"** display
2. Should show number (e.g., "50 Tokens")
3. Create a charging request
4. Refresh page
5. Token count should change (if token cost implemented)
6. Accept a request (if Token reward implemented)
7. Token count should change again

**Expected Result:** ⚠️ Token display visible (reward logic may vary)

---

### TEST CASE 10: Form Validation
**Objective:** Test that form doesn't accept invalid data

**Steps:**
1. Go to Registration page
2. Try submitting with:
   - **Empty email:** Should reject "Email is required"
   - **Invalid email:** "notanemail" Should reject "Invalid email"
   - **Short password:** "123" Should reject "Password too short"
3. Try creating request with empty location
4. Should reject with validation error

**Expected Result:** ✅ All forms validate correctly

---

### TEST CASE 11: Logout & Auth Persistence
**Objective:** Test logout and session persistence

**Steps:**
1. On Dashboard, look for **Logout** button
2. Click Logout
3. Should be redirected to Login page
4. Refresh page
5. Should stay on Login (not redirect to Dashboard)
6. Now login again
7. Should go to Dashboard
8. Refresh Dashboard page
9. Should stay on Dashboard (token persists)

**Expected Result:** ✅ Logout clears session, refresh persists token

---

### TEST CASE 12: Protected Routes
**Objective:** Verify unauthenticated users can't access protected pages

**Steps:**
1. Open Incognito window
2. Try to go directly to: `http://localhost:5174/active-requests`
3. Should be redirected to Login page
4. Try: `http://localhost:5174/create-request`
5. Should be redirected to Login page
6. Login, then these pages should be accessible

**Expected Result:** ✅ Protected routes redirect to login

---

## 📊 Test Results Summary

Create a quick checklist:

```
AUTHENTICATION:
☐ Registration works
☐ Login works
☐ Logout clears session
☐ Session persists on refresh

REQUEST CREATION:
☐ Form validates
☐ Request created successfully
☐ Request appears in database
☐ Socket.io broadcasts request

REQUEST VISIBILITY:
☐ User sees own requests
☐ Other users in same city see requests
☐ Case-insensitive city matching works ✨
☐ Users in different cities don't see requests
☐ "Your Request" badge appears on own requests

REAL-TIME:
☐ Requests appear without refresh
☐ Multiple users see updates simultaneously
☐ Socket.io connections work

ACCEPT REQUEST:
☐ Accept button appears on others' requests
☐ Accept button hidden on own requests
☐ Accepting request updates status
☐ Requestor is notified

NAVIGATION:
☐ Back buttons work
☐ Dashboard accessible
☐ Protected routes redirect
☐ All pages load correctly

FORM VALIDATION:
☐ Required fields enforced
☐ Email format validated
☐ Password requirements enforced
```

---

## 🐛 Troubleshooting

### Server Not Running
```bash
cd "e:\react project\matin\evhelper zip\evhelper"

# Backend
cd server
npm run dev

# Frontend (run in another terminal)
cd ..\client\evhelper
npm run dev
```

### Port Already in Use
```bash
# Find process on port 5000 or 5174
netstat -ano | findstr :5000
# Kill it
taskkill /PID <PID> /F
```

### MongoDB Not Connected
- Check MongoDB is running locally
- Check connection string in `.env`
- Verify MongoDB listening on 127.0.0.1:27017

### Socket.io Not Working
- Check browser console (F12) for connection errors
- Verify CORS settings in server
- Check Network tab for WebSocket connections

---

## 📝 Test Notes

**Date:** 2026-01-19
**Tester:** [Your Name]
**Device:** Windows
**Browser:** [Chrome/Firefox/Edge]

**Key Issues Found:**
1. ...
2. ...

**Notes:**
- ...
- ...

---

## ✨ MOST IMPORTANT TEST

### The "Case-Insensitive City Matching" Test
This is the main fix applied in this session. To verify it works:

1. **User A** registers in city: "**New York**" (capital N, capital Y)
2. **User B** registers in city: "**new york**" (all lowercase)
3. User A creates a charging request
4. User B views active requests
5. **User B MUST see User A's request**

If User B doesn't see the request, the case-insensitive fix didn't work.

If User B DOES see the request, the fix is working! ✅

---

Generated: 2026-01-19
