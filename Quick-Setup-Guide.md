# Quick Setup Guide - Fully Integrated College Chatbot

## 🚀 **Your chatbot is ready! Just 2 simple steps to connect your Google Sheets:**

### Step 1: Get Your Google Sheets API Key

1. **Go to [Google Cloud Console](https://console.cloud.google.com)**
2. **Create a new project** (or select existing)
3. **Enable Google Sheets API:**
   - Go to "APIs & Services" → "Library"
   - Search "Google Sheets API" → Enable it
4. **Create API Key:**
   - Go to "APIs & Services" → "Credentials" 
   - Click "+ CREATE CREDENTIALS" → "API Key"
   - **Copy the API key** - you'll need this!
   - *(Optional but recommended: Restrict to Google Sheets API)*

### Step 2: Prepare Your Google Sheets

1. **Create a Google Sheet** with these **exact tab names:**
   - `timetable`
   - `attendance` 
   - `mess_menu`
   - `events`
   - `contacts`
   - `subjects`

2. **Format each sheet with exact headers:**

**timetable sheet:**
```
RollNumber | Day | Time | Subject | Room
21CS001 | Monday | 9:00-10:00 | Data Structures | CS-101
```

**attendance sheet:**
```
RollNumber | Subject | Attendance
21CS001 | Data Structures | 85%
```

**mess_menu sheet:**
```
Day | Breakfast | Lunch | Snacks | Dinner
Monday | Poha, Tea/Coffee | Rice, Dal | Samosa | Rice, Curry
```

**events sheet:**
```
Title | Date | Time | Club | Venue
Tech Fest 2025 | 2025-10-15 | 10:00 AM | CS Club | Auditorium
```

**contacts sheet:**
```
Name | Contact
Principal Office | +91-9876543210
```

**subjects sheet:**
```
RollNumber | Subject
21CS001 | Data Structures
```

3. **Share your sheet:**
   - Click "Share" → Set to "Anyone with the link can view"
   - **Copy the Sheet ID** from URL (long string between `/d/` and `/edit`)

### Step 3: Configure the Chatbot

1. **Open the chatbot files**
2. **Edit `app.js`** - Find this section at the top:

```javascript
// ============= CONFIGURATION =============
const CONFIG = {
    apiKey: 'YOUR_GOOGLE_API_KEY_HERE', // 👈 PASTE YOUR API KEY HERE
    spreadsheetId: 'YOUR_SPREADSHEET_ID_HERE', // 👈 PASTE YOUR SHEET ID HERE
    sheetNames: {
        timetable: 'timetable',
        attendance: 'attendance',
        mess_menu: 'mess_menu',
        events: 'events',
        contacts: 'contacts',
        subjects: 'subjects'
    }
    // ... rest of config stays the same
};
```

3. **Replace the two values:**
   - Replace `'YOUR_GOOGLE_API_KEY_HERE'` with your actual API key
   - Replace `'YOUR_SPREADSHEET_ID_HERE'` with your actual sheet ID

### Step 4: Test Your Chatbot

1. **Open the chatbot** in your browser
2. **Check the connection status** (top right) - should show "Connected"
3. **Try these test queries:**
   - "What's my timetable?"
   - "Show mess menu"
   - "What are upcoming events?"
   - "Show contacts"

---

## 🎉 **That's it! Your chatbot is now fully connected to Google Sheets!**

### **Features You Get:**

✅ **Real-time data** - Always fresh from your sheets  
✅ **Smart caching** - Fast responses with 5-minute cache  
✅ **Error handling** - Clear messages if something goes wrong  
✅ **Loading states** - Professional user experience  
✅ **Retry mechanism** - Automatic recovery from network issues  
✅ **Natural language** - Users can ask questions naturally  

### **Example Queries Your Chatbot Understands:**

- **Timetable:** "What's my schedule?", "Show timetable for 21CS001", "What classes do I have on Monday?"
- **Attendance:** "My attendance", "Show attendance for 21CS002", "What's my attendance in Data Structures?"
- **Mess Menu:** "Today's menu", "What's for lunch?", "Show dinner for Friday"
- **Events:** "Upcoming events", "What events this month?", "When is Tech Fest?"
- **Contacts:** "Show contacts", "Library number", "Principal office contact"
- **Subjects:** "My subjects", "What subjects does 21CS001 have?"

---

## 🛠 **Troubleshooting:**

**If you see "API Key Required":**
- Make sure you replaced 'YOUR_GOOGLE_API_KEY_HERE' with your actual API key

**If you see "Sheet Not Found":**
- Check your sheet ID is correct
- Make sure sheet is shared publicly ("Anyone with link can view")
- Verify sheet tab names match exactly: timetable, attendance, mess_menu, events, contacts, subjects

**If you see "Network Error":**
- Check your internet connection
- Verify your API key has Google Sheets API enabled

**If some queries don't work:**
- Make sure your sheet headers match exactly the format shown above
- Check if there's data in your sheets

---

## 🔒 **Security Note:**

⚠️ **For production use:** Don't expose API keys in client-side code. Consider implementing a backend proxy server to securely handle API calls.

For development and testing purposes, the current setup works perfectly!