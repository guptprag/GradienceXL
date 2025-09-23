// ============= CONFIGURATION =============
// 🚨 SECURITY WARNING: Never expose API keys in client-side code in production!
// For production use, implement a backend proxy or use environment variables
const CONFIG = {
    apiKey: 'AIzaSyDR-Bk7iVfJK9jA7HBnu4AyBVKReTiQsEc', // Replace with your Google Sheets API key
    spreadsheetId: '1oAdQ-H2sOcQFzwMfX9LKMhoghUyhrXBPPd8gMLj7TQA', // Replace with your Google Sheets ID
    sheetNames: {
        timetable: 'timetable',
        attendance: 'attendance',
        mess_menu: 'mess_menu',
        events: 'events',
        contacts: 'contacts',
        subjects: 'subjects'
    },
    cache: {
        duration: 300000, // 5 minutes in milliseconds
        maxEntries: 10
    },
    retryAttempts: 3,
    retryDelay: 1000 // milliseconds
};

// Google Sheets API Configuration
const SHEETS_API = {
    baseUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
    getUrl: (sheetName) => 
        `${SHEETS_API.baseUrl}/${CONFIG.spreadsheetId}/values/${sheetName}?key=${CONFIG.apiKey}&majorDimension=ROWS`
};

// Conversation State Management
let conversationState = {
    waitingFor: null, // 'roll_number' when waiting for input
    pendingAction: null, // 'timetable' or 'attendance'
    lastRollNumber: null // remember last used roll number
};
// ========================================

// Cache Management System
class DataCache {
    constructor() {
        console.log('[DataCache] constructor');
        this.cache = new Map();
        this.timestamps = new Map();
    }

    set(key, data) {
        console.log('[DataCache] set', { key, hasData: !!data, dataType: typeof data });
        this.cache.set(key, data);
        this.timestamps.set(key, Date.now());
        this.cleanupOldEntries();
    }

    get(key) {
        console.log('[DataCache] get', { key });
        const timestamp = this.timestamps.get(key);
        if (!timestamp || Date.now() - timestamp > CONFIG.cache.duration) {
            console.log('[DataCache] get -> expired or missing', { key, timestamp });
            this.cache.delete(key);
            this.timestamps.delete(key);
            return null;
        }
        console.log('[DataCache] get -> hit', { key, ageMs: Date.now() - timestamp });
        return this.cache.get(key);
    }

    clear() {
        console.log('[DataCache] clear');
        this.cache.clear();
        this.timestamps.clear();
    }

    cleanupOldEntries() {
        console.log('[DataCache] cleanupOldEntries', { size: this.cache.size, max: CONFIG.cache.maxEntries });
        if (this.cache.size > CONFIG.cache.maxEntries) {
            const oldestKey = this.timestamps.keys().next().value;
            console.log('[DataCache] evicting oldest', { oldestKey });
            this.cache.delete(oldestKey);
            this.timestamps.delete(oldestKey);
        }
    }

    getLastUpdated(key) {
        const ts = this.timestamps.get(key);
        console.log('[DataCache] getLastUpdated', { key, ts });
        return ts;
    }
}

// College Chatbot Application
class CollegeChatbot {
    constructor() {
        console.log('[Chatbot] constructor start');
        this.cache = new DataCache();
        this.isOnline = navigator.onLine;
        this.apiConnected = false;
        this.initializeElements();
        this.setupEventListeners();
        this.checkConfiguration();
        this.initializeAPI();
        console.log('[Chatbot] constructor end');
    }

    initializeElements() {
        console.log('[Chatbot] initializeElements');
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            typingIndicator: document.getElementById('typingIndicator'),
            apiStatus: document.getElementById('apiStatus'),
            statusText: document.getElementById('statusText'),
            refreshBtn: document.getElementById('refreshBtn'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            lastUpdated: document.getElementById('lastUpdated'),
            cacheInfo: document.getElementById('cacheInfo')
        };

        // Verify all elements exist
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.error('Missing DOM elements:', missingElements);
        } else {
            console.log('[Chatbot] All DOM elements present');
        }
    }

    setupEventListeners() {
        console.log('[Chatbot] setupEventListeners');
        // Send message on Enter key
        this.elements.messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('[UI] Enter pressed in messageInput');
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button click
        this.elements.sendButton?.addEventListener('click', (e) => {
            console.log('[UI] sendButton clicked');
            e.preventDefault();
            this.sendMessage();
        });

        // Refresh button click
        this.elements.refreshBtn?.addEventListener('click', () => {
            console.log('[UI] refreshBtn clicked');
            this.refreshData();
        });

        // Quick action buttons (legacy)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-btn')) {
                console.log('[UI] quick-btn clicked', { query: e.target.getAttribute('data-query') });
                e.preventDefault();
                const query = e.target.getAttribute('data-query');
                if (query) {
                    this.elements.messageInput.value = query;
                    this.sendMessage();
                }
            }
        });

        // New shortcut buttons
        document.addEventListener('click', (e) => {
            const shortcutBtn = e.target.closest('.shortcut-btn');
            if (shortcutBtn) {
                const action = shortcutBtn.getAttribute('data-action');
                const needsRoll = shortcutBtn.getAttribute('data-needs-roll') === 'true';
                console.log('[UI] shortcut-btn clicked', { action, needsRoll });
                e.preventDefault();
                this.handleShortcutClick(action, needsRoll);
            }
        });

        // Online/offline detection
        window.addEventListener('online', () => {
            console.log('[Net] online event');
            this.isOnline = true;
            this.updateConnectionStatus();
        });

        window.addEventListener('offline', () => {
            console.log('[Net] offline event');
            this.isOnline = false;
            this.updateConnectionStatus();
        });
    }

    handleShortcutClick(action, needsRoll) {
        console.log('[Chatbot] handleShortcutClick', { action, needsRoll });
        if (needsRoll) {
            // Actions that need roll number (timetable, attendance)
            this.promptForRollNumber(action);
        } else {
            // Actions that don't need roll number (mess_menu, events, contacts, subjects)
            this.executeAction(action);
        }
    }

    promptForRollNumber(action) {
        console.log('[Chatbot] promptForRollNumber', { action });
        conversationState.waitingFor = 'roll_number';
        conversationState.pendingAction = action;

        const rollPrompt = this.createRollNumberPrompt(action);
        this.addMessage(rollPrompt, 'bot');
        
        // Focus on input for user convenience
        this.elements.messageInput.focus();
        const example = this.getRandomRollExample();
        console.log('[Chatbot] prompt placeholder example', { example });
        this.elements.messageInput.placeholder = `Enter your roll number (e.g., ${example})`;
    }

    createRollNumberPrompt(action) {
        console.log('[Chatbot] createRollNumberPrompt', { action });
        const actionName = action === 'timetable' ? 'Timetable' : 'Attendance';
        const lastUsed = conversationState.lastRollNumber ? 
            `<p>💡 <em>Last used: ${conversationState.lastRollNumber}</em></p>` : '';

        const html = `
            <div class="roll-prompt">
                <h4>🔑 ${actionName} Request</h4>
                <p>Please enter your roll number to view your personalized ${actionName.toLowerCase()}:</p>
                <p><strong>Format examples:</strong> 21CS001, 22ME005, 20EC003</p>
                ${lastUsed}
            </div>
        `;
        console.log('[Chatbot] createRollNumberPrompt -> html length', html.length);
        return html;
    }

    getRandomRollExample() {
        console.log('[Chatbot] getRandomRollExample');
        const examples = ['21CS001', '21ME001', '21EC001', '22CS001', '20CS001'];
        const pick = examples[Math.floor(Math.random() * examples.length)];
        console.log('[Chatbot] getRandomRollExample ->', pick);
        return pick;
    }

    async executeAction(action, rollNumber = null) {
        console.log('[Chatbot] executeAction start', { action, rollNumber });
        try {
            let response;
            switch (action) {
                case 'timetable':
                    console.log('[Chatbot] executeAction -> timetable');
                    response = await this.handleTimetableQuery(rollNumber ? `show timetable for ${rollNumber}` : 'show timetable');
                    break;
                case 'attendance':
                    console.log('[Chatbot] executeAction -> attendance');
                    response = await this.handleAttendanceQuery(rollNumber ? `show attendance for ${rollNumber}` : 'show attendance');
                    break;
                case 'mess_menu':
                    console.log('[Chatbot] executeAction -> mess_menu');
                    response = await this.handleMessMenuQuery('show today\'s menu');
                    break;
                case 'events':
                    console.log('[Chatbot] executeAction -> events');
                    response = await this.handleEventsQuery('show events');
                    break;
                case 'contacts':
                    console.log('[Chatbot] executeAction -> contacts');
                    response = await this.handleContactsQuery('show contacts');
                    break;
                case 'subjects':
                    console.log('[Chatbot] executeAction -> subjects');
                    response = await this.handleSubjectsQuery(rollNumber ? `show subjects for ${rollNumber}` : 'show subjects');
                    break;
                default:
                    console.log('[Chatbot] executeAction -> unknown action');
                    response = 'Unknown action. Please try again.';
            }

            // Add slight delay for better UX
            this.showTypingIndicator();
            await this.delay(800);
            this.hideTypingIndicator();
            
            this.addMessage(response, 'bot');
        } catch (error) {
            this.hideTypingIndicator();
            console.error('Error executing action:', error);
            this.addMessage(this.getErrorMessage(error), 'bot');
        } finally {
            console.log('[Chatbot] executeAction end', { action });
        }
    }

    validateRollNumber(rollNumber) {
        console.log('[Chatbot] validateRollNumber', { rollNumber });
        // Pattern: 2-3 digits + 2-3 letters + 2-3 digits (flexible for different colleges)
        const pattern = /^B2\d{4}$/i;
        const valid = pattern.test(rollNumber.trim());
        console.log('[Chatbot] validateRollNumber ->', valid);
        return valid;
    }

    checkConfiguration() {
        console.log('[Chatbot] checkConfiguration');
        if (CONFIG.apiKey === 'YOUR_GOOGLE_API_KEY_HERE' || 
            CONFIG.spreadsheetId === 'YOUR_SPREADSHEET_ID_HERE') {
            this.showConfigurationWarning();
            return false;
        }
        return true;
    }

    showConfigurationWarning() {
        console.log('[Chatbot] showConfigurationWarning');
        const warningHTML = `
            <div class="message bot-message">
                <div class="message-avatar">⚠️</div>
                <div class="message-content">
                    <div class="message-bubble">
                        <div class="config-warning">
                            <strong>Configuration Required</strong>
                            <p>Please configure your Google Sheets API credentials in the app.js file:</p>
                            <p>1. Replace <code>YOUR_GOOGLE_API_KEY_HERE</code> with your Google Sheets API key</p>
                            <p>2. Replace <code>YOUR_SPREADSHEET_ID_HERE</code> with your Google Sheets ID</p>
                            <p>3. Ensure your Google Sheets has the required sheet tabs: ${Object.values(CONFIG.sheetNames).join(', ')}</p>
                        </div>
                    </div>
                    <div class="message-time">${this.getCurrentTime()}</div>
                </div>
            </div>
        `;
        this.elements.chatMessages.insertAdjacentHTML('beforeend', warningHTML);
        this.scrollToBottom();
    }

    async initializeAPI() {
        console.log('[Chatbot] initializeAPI start');
        if (!this.checkConfiguration()) {
            console.log('[Chatbot] initializeAPI aborted due to bad config');
            return;
        }

        this.updateStatus('connecting', 'Connecting to API...');
        
        try {
            // Test API connection with a simple request
            await this.fetchSheetData('timetable');
            this.apiConnected = true;
            this.updateStatus('connected', 'Connected to Google Sheets');
            this.updateCacheInfo();
            console.log('[Chatbot] initializeAPI success');
        } catch (error) {
            this.apiConnected = false;
            this.updateStatus('error', 'API Connection Failed');
            console.error('API initialization failed:', error);
            this.addMessage(this.getErrorMessage(error), 'bot');
        } finally {
            console.log('[Chatbot] initializeAPI end');
        }
    }

    async fetchSheetData(sheetName, useCache = true) {
        console.log('[API] fetchSheetData start', { sheetName, useCache });
        // Check cache first if enabled
        if (useCache) {
            const cachedData = this.cache.get(sheetName);
            if (cachedData) {
                console.log(`[API] Using cached data for ${sheetName}`);
                return cachedData;
            }
        }

        // Check online status
        if (!this.isOnline) {
            console.log('[API] fetchSheetData -> offline');
            throw new Error('No internet connection. Please check your network and try again.');
        }

        const url = SHEETS_API.getUrl(sheetName);
        console.log('[API] fetchSheetData url', url);
        let lastError;

        // Retry mechanism
        for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
            try {
                console.log(`Fetching ${sheetName} (attempt ${attempt}/${CONFIG.retryAttempts})`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                console.log('[API] fetch response', { ok: response.ok, status: response.status });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.log('[API] fetch non-ok body', errorText);
                    throw new Error(`HTTP ${response.status}: ${this.getHttpErrorMessage(response.status, errorText)}`);
                }

                const result = await response.json();
                console.log('[API] fetch json parsed', { hasValues: !!result.values, rows: result.values?.length });

                if (!result.values || !Array.isArray(result.values)) {
                    throw new Error(`No data found in sheet "${sheetName}". Please check if the sheet exists and has data.`);
                }

                // Cache the successful result
                this.cache.set(sheetName, result.values);
                this.updateCacheInfo();
                
                console.log('[API] fetchSheetData success', { sheetName, rows: result.values.length });
                return result.values;

            } catch (error) {
                lastError = error;
                console.error(`Attempt ${attempt} failed for ${sheetName}:`, error);
                
                // Don't retry on certain errors
                if (error.message.includes('404') || error.message.includes('403')) {
                    console.log('[API] fetchSheetData no-retry error', { sheetName });
                    throw error;
                }
                
                // Wait before retrying (except on last attempt)
                if (attempt < CONFIG.retryAttempts) {
                    const delayMs = CONFIG.retryDelay * attempt;
                    console.log('[API] retrying after delay', { delayMs });
                    await this.delay(delayMs);
                }
            }
        }

        console.log('[API] fetchSheetData throwing lastError');
        throw lastError;
    }

    getHttpErrorMessage(status, errorText) {
        console.log('[API] getHttpErrorMessage', { status });
        switch (status) {
            case 400:
                return 'Bad request. Please check your API key and spreadsheet ID.';
            case 403:
                return 'Access forbidden. Please check your API key permissions and spreadsheet sharing settings.';
            case 404:
                return 'Spreadsheet or sheet not found. Please verify your spreadsheet ID and sheet names.';
            case 429:
                return 'API rate limit exceeded. Please try again in a few minutes.';
            case 500:
                return 'Google Sheets API server error. Please try again later.';
            default:
                return errorText || 'Unknown error occurred';
        }
    }

    delay(ms) {
        console.log('[Util] delay', { ms });
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async sendMessage() {
        console.log('[Chatbot] sendMessage start');
        const message = this.elements.messageInput.value.trim();
        if (!message) {
            console.log('[Chatbot] sendMessage aborted: empty message');
            return;
        }

        // Disable send button and input during processing
        this.elements.sendButton.disabled = true;
        this.elements.messageInput.disabled = true;

        // Add user message
        this.addMessage(message, 'user');
        this.elements.messageInput.value = '';
        this.elements.messageInput.placeholder = 'Type your message here...';

        // Check if we're waiting for roll number input
        if (conversationState.waitingFor === 'roll_number') {
            console.log('[Chatbot] expecting roll_number, delegating to handleRollNumberInput');
            await this.handleRollNumberInput(message);
        } else {
            // Show typing indicator with a slight delay for better UX
            setTimeout(() => {
                console.log('[UI] showTypingIndicator (delayed)');
                this.showTypingIndicator();
            }, 300);

            try {
                // Add minimum delay to show typing indicator
                const [response] = await Promise.all([
                    this.processMessage(message),
                    this.delay(1200) // Minimum 1.2 seconds to show typing indicator
                ]);
                
                this.hideTypingIndicator();
                this.addMessage(response, 'bot');
            } catch (error) {
                this.hideTypingIndicator();
                console.error('Error processing message:', error);
                this.addMessage(this.getErrorMessage(error), 'bot');
            }
        }

        // Re-enable send button and input
        this.elements.sendButton.disabled = false;
        this.elements.messageInput.disabled = false;
        this.elements.messageInput.focus();
        console.log('[Chatbot] sendMessage end');
    }

    async handleRollNumberInput(rollNumber) {
        console.log('[Chatbot] handleRollNumberInput', { rollNumber });
        const cleanRollNumber = rollNumber.trim().toUpperCase();

        if (!this.validateRollNumber(cleanRollNumber)) {
            console.log('[Chatbot] invalid roll number provided');
            this.addMessage(`❌ Invalid roll number format. Please use format like: ${this.getRandomRollExample()}`, 'bot');
            return;
        }

        // Store roll number and clear waiting state
        conversationState.lastRollNumber = cleanRollNumber;
        const pendingAction = conversationState.pendingAction;
        console.log('[Chatbot] roll number valid', { cleanRollNumber, pendingAction });
        
        // Clear conversation state
        conversationState.waitingFor = null;
        conversationState.pendingAction = null;

        // Execute the pending action
        this.addMessage(`✅ Roll number received: ${cleanRollNumber}`, 'bot');
        await this.executeAction(pendingAction, cleanRollNumber);
    }

    async processMessage(message) {
        console.log('[Chatbot] processMessage', { message });
        const lowerMessage = message.toLowerCase().trim();

        // Help queries
        if (lowerMessage.includes('help') || lowerMessage === '?') {
            console.log('[NLP] matched help');
            return this.getHelpMessage();
        }

        // Greetings
        if (lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
            console.log('[NLP] matched greeting');
            return "Hello! 👋 I'm your college chatbot with live Google Sheets integration. I can help you with timetables, attendance, mess menu, events, contacts, and subjects. Use the quick shortcuts above or ask me naturally! All data is fetched in real-time! What would you like to know?";
        }

        // Timetable queries
        if (lowerMessage.includes('timetable') || lowerMessage.includes('schedule')) {
            console.log('[NLP] matched timetable');
            return await this.handleTimetableQuery(lowerMessage);
        }

        // Attendance queries
        if (lowerMessage.includes('attendance')) {
            console.log('[NLP] matched attendance');
            return await this.handleAttendanceQuery(lowerMessage);
        }

        // Mess menu queries
        if (lowerMessage.includes('menu') || lowerMessage.includes('mess') || lowerMessage.includes('food') || 
            lowerMessage.includes('breakfast') || lowerMessage.includes('lunch') || 
            lowerMessage.includes('dinner') || lowerMessage.includes('snacks') || lowerMessage.includes('today')) {
            console.log('[NLP] matched mess menu');
            return await this.handleMessMenuQuery(lowerMessage);
        }

        // Events queries
        if (lowerMessage.includes('event') || lowerMessage.includes('fest') || lowerMessage.includes('celebration') ||
            lowerMessage.includes('upcoming')) {
            console.log('[NLP] matched events');
            return await this.handleEventsQuery(lowerMessage);
        }

        // Contacts queries
        if (lowerMessage.includes('contact') || lowerMessage.includes('number') || lowerMessage.includes('phone')) {
            console.log('[NLP] matched contacts');
            return await this.handleContactsQuery(lowerMessage);
        }

        // Subjects queries
        if (lowerMessage.includes('subject')) {
            console.log('[NLP] matched subjects');
            return await this.handleSubjectsQuery(lowerMessage);
        }

        console.log('[NLP] no intent matched, returning default response');
        return this.getDefaultResponse();
    }

    async handleTimetableQuery(query) {
        console.log('[Handler] handleTimetableQuery', { query });
        try {
            const data = await this.fetchSheetData('timetable');
            const headers = data[0];
            const rows = data.slice(1);
            console.log('[Handler] timetable rows', rows.length, 'headers', headers);

            const rollNumber = this.extractRollNumber(query);
            const day = this.extractDay(query);
            console.log('[Handler] timetable filters', { rollNumber, day });

            let filteredRows = rows;

            if (rollNumber) {
                filteredRows = filteredRows.filter(row => row[0] === rollNumber);
            }

            if (day) {
                filteredRows = filteredRows.filter(row => row[1] && row[1].toLowerCase() === day);
            }

            console.log('[Handler] timetable filteredRows', filteredRows.length);

            if (filteredRows.length === 0) {
                const availableRolls = [...new Set(rows.map(row => row[0]).filter(Boolean))];
                return rollNumber ? 
                    `No timetable found for roll number ${rollNumber}. Available roll numbers: ${availableRolls.join(', ')}` :
                    "No timetable data found. Please specify a roll number or click the Timetable button above.";
            }

            return this.formatTimetableResponse(filteredRows, rollNumber, day);
        } catch (error) {
            console.log('[Handler] handleTimetableQuery error', error);
            return this.getErrorMessage(error);
        }
    }

    async handleAttendanceQuery(query) {
        console.log('[Handler] handleAttendanceQuery', { query });
        try {
            const data = await this.fetchSheetData('attendance');
            const headers = data[0];
            const rows = data.slice(1);
            console.log('[Handler] attendance rows', rows.length, 'headers', headers);

            const rollNumber = this.extractRollNumber(query);
            let filteredRows = rows;

            if (rollNumber) {
                filteredRows = filteredRows.filter(row => row[0] === rollNumber);
            }

            console.log('[Handler] attendance filteredRows', filteredRows.length);

            if (filteredRows.length === 0) {
                const availableRolls = [...new Set(rows.map(row => row[0]).filter(Boolean))];
                return rollNumber ? 
                    `No attendance found for roll number ${rollNumber}. Available roll numbers: ${availableRolls.join(', ')}` :
                    "No attendance data found. Please specify a roll number or click the Attendance button above.";
            }

            return this.formatAttendanceResponse(filteredRows, rollNumber);
        } catch (error) {
            console.log('[Handler] handleAttendanceQuery error', error);
            return this.getErrorMessage(error);
        }
    }

    async handleMessMenuQuery(query) {
        console.log('[Handler] handleMessMenuQuery', { query });
        try {
            const data = await this.fetchSheetData('mess_menu');
            const headers = data[0];
            const rows = data.slice(1);
            console.log('[Handler] mess_menu rows', rows.length, 'headers', headers);

            const today = this.getCurrentDay();
            const day = this.extractDay(query) || (query.includes('today') ? today : null);
            console.log('[Handler] mess_menu day resolved', { day, today });

            if (day) {
                const dayData = rows.find(row => row[0] && row[0].toLowerCase() === day);
                if (dayData) {
                    return this.formatDayMenu(dayData);
                } else {
                    return `Menu not found for ${day}. Available days: ${rows.map(row => row[0]).join(', ')}`;
                }
            }

            return this.formatFullMenu(rows);
        } catch (error) {
            console.log('[Handler] handleMessMenuQuery error', error);
            return this.getErrorMessage(error);
        }
    }

    async handleEventsQuery(query) {
        console.log('[Handler] handleEventsQuery', { query });
        try {
            const data = await this.fetchSheetData('events');
            const headers = data[0];
            const rows = data.slice(1);
            console.log('[Handler] events rows', rows.length, 'headers', headers);

            if (rows.length === 0) {
                return "No events data found in the spreadsheet.";
            }

            return this.formatEventsResponse(rows);
        } catch (error) {
            console.log('[Handler] handleEventsQuery error', error);
            return this.getErrorMessage(error);
        }
    }

    async handleContactsQuery(query) {
        console.log('[Handler] handleContactsQuery', { query });
        try {
            const data = await this.fetchSheetData('contacts');
            const headers = data[0];
            const rows = data.slice(1);
            console.log('[Handler] contacts rows', rows.length, 'headers', headers);

            const department = this.extractDepartment(query);
            console.log('[Handler] contacts filter department', { department });

            if (department) {
                const contactData = rows.filter(row => 
                    row[0] && row[0].toLowerCase().includes(department)
                );
                console.log('[Handler] contacts filteredRows', contactData.length);
                if (contactData.length > 0) {
                    return this.formatContactsResponse(contactData, `Contact for ${department}`);
                } else {
                    const availableDepts = rows.map(row => row[0]).join(', ');
                    return `No contact found for "${department}". Available contacts: ${availableDepts}`;
                }
            }

            return this.formatContactsResponse(rows, "All Contacts");
        } catch (error) {
            console.log('[Handler] handleContactsQuery error', error);
            return this.getErrorMessage(error);
        }
    }

    async handleSubjectsQuery(query) {
        console.log('[Handler] handleSubjectsQuery', { query });
        try {
            const data = await this.fetchSheetData('subjects');
            const headers = data[0];
            const rows = data.slice(1);
            console.log('[Handler] subjects rows', rows.length, 'headers', headers);

            const rollNumber = this.extractRollNumber(query);
            console.log('[Handler] subjects filter rollNumber', { rollNumber });

            if (rollNumber) {
                const subjectData = rows.filter(row => row[0] === rollNumber);
                console.log('[Handler] subjects filteredRows', subjectData.length);
                if (subjectData.length > 0) {
                    return this.formatSubjectsResponse(subjectData, rollNumber);
                } else {
                    const availableRolls = [...new Set(rows.map(row => row[0]).filter(Boolean))];
                    return `No subjects found for roll number ${rollNumber}. Available roll numbers: ${availableRolls.join(', ')}`;
                }
            }

            return this.formatSubjectsResponse(rows, "All Subjects");
        } catch (error) {
            console.log('[Handler] handleSubjectsQuery error', error);
            return this.getErrorMessage(error);
        }
    }

    // Data extraction helpers
    extractRollNumber(query) {
        console.log('[Extract] extractRollNumber from', query);
        const match = query.match(/\b[A-Za-z]\d{5}\b/);
        const val = match ? match[0].toUpperCase() : null;
        console.log('[Extract] extractRollNumber ->', val);
        return val;
    }

    extractDay(query) {
        console.log('[Extract] extractDay from', query);
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const val = days.find(day => query.includes(day)) || null;
        console.log('[Extract] extractDay ->', val);
        return val;
    }

    extractDepartment(query) {
        console.log('[Extract] extractDepartment from', query);
        const departments = ['principal', 'admission', 'academic', 'hostel', 'library', 'medical', 'canteen', 'security', 'transport', 'placement'];
        const val = departments.find(dept => query.includes(dept)) || null;
        console.log('[Extract] extractDepartment ->', val);
        return val;
    }

    getCurrentDay() {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const d = days[new Date().getDay()];
        console.log('[Util] getCurrentDay ->', d);
        return d;
    }

    // Response formatters
    formatTimetableResponse(data, rollNumber, day) {
        console.log('[Format] formatTimetableResponse', { rows: data.length, rollNumber, day });
        const title = rollNumber ? 
            `📅 Timetable for ${rollNumber}${day ? ` on ${day}` : ''}` :
            '📅 Timetable Information';

        let html = `<strong>${title}:</strong><br><br>`;
        html += '<table class="data-table">';
        html += '<tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th></tr>';
        
        data.forEach(row => {
            html += `<tr><td>${row[1] || ''}</td><td>${row[2] || ''}</td><td>${row[3] || ''}</td><td>${row[4] || ''}</td></tr>`;
        });
        
        html += '</table>';
        
        if (rollNumber) {
            conversationState.lastRollNumber = rollNumber;
        }
        
        html += this.getDataSourceFooter('timetable');
        console.log('[Format] formatTimetableResponse -> html length', html.length);
        return html;
    }

    formatAttendanceResponse(data, rollNumber) {
        console.log('[Format] formatAttendanceResponse', { rows: data.length, rollNumber });
        const title = rollNumber ? `📊 Attendance for ${rollNumber}` : '📊 Attendance Information';
        
        let html = `<strong>${title}:</strong><br><br>`;
        html += '<table class="data-table">';
        html += '<tr><th>Subject</th><th>Attendance</th></tr>';
        
        data.forEach(row => {
            const attendanceValue = row[2] || '';
            const attendanceClass = this.getAttendanceClass(attendanceValue);
            html += `<tr><td>${row[1] || ''}</td><td class="${attendanceClass}">${attendanceValue}</td></tr>`;
        });
        
        html += '</table>';
        
        if (rollNumber) {
            conversationState.lastRollNumber = rollNumber;
        }
        
        html += this.getDataSourceFooter('attendance');
        console.log('[Format] formatAttendanceResponse -> html length', html.length);
        return html;
    }

    getAttendanceClass(attendance) {
        console.log('[Format] getAttendanceClass', { attendance });
        if (typeof attendance === 'string' && attendance.includes('%')) {
            const percentage = parseInt(attendance);
            if (percentage >= 75) return 'status--success';
            if (percentage >= 60) return 'status--warning';
            return 'status--error';
        }
        return '';
    }

    formatDayMenu(dayData) {
        console.log('[Format] formatDayMenu', { day: dayData[0] });
        let html = `<strong>🍽️ Menu for ${dayData[0]}:</strong><br><br>`;
        html += `🌅 <strong>Breakfast:</strong> ${dayData[1] || 'Not available'}<br><br>`;
        html += `🍽️ <strong>Lunch:</strong> ${dayData[2] || 'Not available'}<br><br>`;
        html += `☕ <strong>Snacks:</strong> ${dayData[3] || 'Not available'}<br><br>`;
        html += `🌙 <strong>Dinner:</strong> ${dayData[4] || 'Not available'}`;
        html += this.getDataSourceFooter('mess_menu');
        console.log('[Format] formatDayMenu -> html length', html.length);
        return html;
    }

    formatFullMenu(data) {
        console.log('[Format] formatFullMenu', { rows: data.length });
        let html = '<strong>🍽️ Weekly Mess Menu:</strong><br><br>';
        html += '<table class="data-table">';
        html += '<tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Snacks</th><th>Dinner</th></tr>';
        
        data.forEach(row => {
            html += `<tr><td><strong>${row[0] || ''}</strong></td><td>${row[1] || ''}</td><td>${row[2] || ''}</td><td>${row[3] || ''}</td><td>${row[4] || ''}</td></tr>`;
        });
        
        html += '</table>';
        html += this.getDataSourceFooter('mess_menu');
        console.log('[Format] formatFullMenu -> html length', html.length);
        return html;
    }

    formatEventsResponse(data) {
        console.log('[Format] formatEventsResponse', { rows: data.length });
        let html = '<strong>🎉 Upcoming Events:</strong><br><br>';
        html += '<table class="data-table">';
        html += '<tr><th>Event</th><th>Date</th><th>Time</th><th>Club</th><th>Venue</th></tr>';
        
        data.forEach(row => {
            html += `<tr><td>${row[0] || ''}</td><td>${row[1] || ''}</td><td>${row[2] || ''}</td><td>${row[3] || ''}</td><td>${row[4] || ''}</td></tr>`;
        });
        
        html += '</table>';
        html += this.getDataSourceFooter('events');
        console.log('[Format] formatEventsResponse -> html length', html.length);
        return html;
    }

    formatContactsResponse(data, title) {
        console.log('[Format] formatContactsResponse', { rows: data.length, title });
        let html = `<strong>📞 ${title}:</strong><br><br>`;
        html += '<table class="data-table">';
        html += '<tr><th>Department</th><th>Contact Number</th></tr>';
        
        data.forEach(row => {
            const phoneNumber = row[1] || '';
            html += `<tr><td>${row[0] || ''}</td><td><a href="tel:${phoneNumber}" target="_blank">${phoneNumber}</a></td></tr>`;
        });
        
        html += '</table>';
        html += this.getDataSourceFooter('contacts');
        console.log('[Format] formatContactsResponse -> html length', html.length);
        return html;
    }

    formatSubjectsResponse(data, rollNumber) {
        console.log('[Format] formatSubjectsResponse', { rows: data.length, rollNumber });
        const title = rollNumber ? `📚 Subjects for ${rollNumber}` : '📚 All Subjects';
        
        let html = `<strong>${title}:</strong><br><br>`;
        
        if (rollNumber) {
            html += '<ul>';
            data.forEach(row => {
                html += `<li>📚 ${row[1] || ''}</li>`;
            });
            html += '</ul>';
            conversationState.lastRollNumber = rollNumber;
        } else {
            html += '<table class="data-table">';
            html += '<tr><th>Roll Number</th><th>Subject</th></tr>';
            
            data.forEach(row => {
                html += `<tr><td>${row[0] || ''}</td><td>${row[1] || ''}</td></tr>`;
            });
            
            html += '</table>';
        }
        
        html += this.getDataSourceFooter('subjects');
        console.log('[Format] formatSubjectsResponse -> html length', html.length);
        return html;
    }

    getDataSourceFooter(sheetName) {
        const lastUpdated = this.cache.getLastUpdated(sheetName);
        const timeStr = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Unknown';
        const footer = `<div class="data-source">📊 Data from Google Sheets • Last updated: ${timeStr}</div>`;
        console.log('[Format] getDataSourceFooter', { sheetName, timeStr });
        return footer;
    }

    // UI helpers
    addMessage(content, sender) {
        console.log('[UI] addMessage', { sender, contentLength: (content || '').length });
        if (!this.elements.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'user' ? '👤' : '🤖';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        messageBubble.innerHTML = content;

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = this.getCurrentTime();

        messageContent.appendChild(messageBubble);
        messageContent.appendChild(messageTime);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);

        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        console.log('[UI] showTypingIndicator');
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.classList.add('show');
            this.scrollToBottom();
        }
    }

    hideTypingIndicator() {
        console.log('[UI] hideTypingIndicator');
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.classList.remove('show');
        }
    }

    scrollToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
            console.log('[UI] scrollToBottom');
        }
    }

    getCurrentTime() {
        const t = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        console.log('[Util] getCurrentTime ->', t);
        return t;
    }

    updateStatus(type, message) {
        console.log('[UI] updateStatus', { type, message });
        const statusDot = this.elements.apiStatus?.querySelector('.status-dot');
        const statusText = this.elements.statusText;

        if (statusDot && statusText) {
            statusDot.className = `status-dot ${type}`;
            statusText.textContent = message;
        }
    }

    updateConnectionStatus() {
        console.log('[UI] updateConnectionStatus', { isOnline: this.isOnline, apiConnected: this.apiConnected });
        if (!this.isOnline) {
            this.updateStatus('error', 'Offline');
        } else if (this.apiConnected) {
            this.updateStatus('connected', 'Connected');
        } else {
            this.updateStatus('connecting', 'Connecting...');
        }
    }

    updateCacheInfo() {
        console.log('[UI] updateCacheInfo');
        if (this.elements.lastUpdated) {
            const now = new Date().toLocaleTimeString();
            this.elements.lastUpdated.textContent = now;
        }
    }

    async refreshData() {
        console.log('[Chatbot] refreshData start');
        if (!this.elements.refreshBtn) return;

        this.elements.refreshBtn.disabled = true;
        this.elements.refreshBtn.classList.add('loading');

        try {
            // Clear cache
            this.cache.clear();
            this.updateStatus('connecting', 'Refreshing data...');

            // Test connection with a simple request
            await this.fetchSheetData('timetable', false);
            
            this.updateStatus('connected', 'Data refreshed');
            this.updateCacheInfo();
            this.addMessage('✅ Data refreshed successfully! All information is now up to date.', 'bot');
            
        } catch (error) {
            this.updateStatus('error', 'Refresh failed');
            this.addMessage(this.getErrorMessage(error), 'bot');
        } finally {
            this.elements.refreshBtn.disabled = false;
            this.elements.refreshBtn.classList.remove('loading');
            console.log('[Chatbot] refreshData end');
        }
    }

    getErrorMessage(error) {
        console.log('[Chatbot] getErrorMessage', { message: error?.message });
        const baseMessage = '❌ <strong>Error:</strong> ';
        
        if (!this.isOnline) {
            return baseMessage + 'No internet connection. Please check your network and try again.';
        }

        if (error.message.includes('403')) {
            return baseMessage + 'Access denied. Please check your API key permissions and spreadsheet sharing settings.';
        }

        if (error.message.includes('404')) {
            return baseMessage + 'Spreadsheet or sheet not found. Please verify your spreadsheet ID and sheet names.';
        }

        if (error.message.includes('429')) {
            return baseMessage + 'API rate limit exceeded. Please try again in a few minutes.';
        }

        return baseMessage + (error.message || 'An unexpected error occurred. Please try again.');
    }

    getHelpMessage() {
        console.log('[Chatbot] getHelpMessage');
        return `<strong>🤖 College ChatBot Help:</strong><br><br>
            <strong>🚀 Quick Shortcuts:</strong><br>
            Use the buttons above for instant access to:<br>
            • 📅 Timetable (requires roll number)<br>
            • 📊 Attendance (requires roll number)<br>
            • 🍽️ Mess Menu<br>
            • 🎉 Events<br>
            • 📞 Contacts<br>
            • 📚 Subjects<br><br>
            <strong>💬 Natural Language Queries:</strong><br>
            • "What's my timetable?" or "Show timetable for 21CS001"<br>
            • "What's my attendance?" or "Show attendance for 21CS001"<br>
            • "What's today's menu?" or "Show mess menu"<br>
            • "What are upcoming events?" or "Show events"<br>
            • "Show contacts" or "What's the number for library?"<br>
            • "What subjects does 21CS001 have?"<br><br>
            <strong>🔑 Roll Number Format:</strong><br>
            Examples: 21CS001, 22ME005, 20EC003<br><br>
            <strong>🔄 Data Management:</strong><br>
            • Click the refresh button to update data<br>
            • Data is cached for 5 minutes for better performance<br>
            ${conversationState.lastRollNumber ? `• Last used roll number: ${conversationState.lastRollNumber}` : ''}<br><br>
            <strong>💡 Features:</strong><br>
            • ✅ Real-time Google Sheets integration<br>
            • ⚡ Smart caching for faster responses<br>
            • 🔄 Automatic retry on failures<br>
            • 🌐 Online/offline detection<br>
            • 🔑 Roll number memory for quick access<br><br>
            Just click the shortcuts or ask me naturally - I'll understand! 😊`;
    }

    getDefaultResponse() {
        console.log('[Chatbot] getDefaultResponse');
        const suggestions = [
            "I'm not sure I understand that. Try using the quick shortcuts above or asking about:<br>• Timetables (e.g., 'show timetable for 21CS001')<br>• Attendance<br>• Mess menu<br>• Events<br>• Contacts<br>• Subjects<br><br>Type 'help' for more examples!",
            "Could you rephrase that? Use the colorful buttons above for quick access, or try asking about college information like schedules, menus, and events. Type 'help' to see what I can do!",
            "Hmm, I didn't quite catch that. Try the quick shortcuts above or one of these:<br>• 'What's today's menu?'<br>• 'Show timetable for 21CS001'<br>• 'What are upcoming events?'<br>• 'Show contacts'",
            "I'm not sure about that query. Use the shortcut buttons above for instant access, or I can help you with live data from Google Sheets:<br>📅 Timetables<br>📊 Attendance<br>🍽️ Mess Menu<br>🎉 Events<br>📞 Contacts<br>📚 Subjects<br><br>What would you like to know?"
        ];
        
        const pick = suggestions[Math.floor(Math.random() * suggestions.length)];
        console.log('[Chatbot] getDefaultResponse -> picked index', suggestions.indexOf(pick));
        return pick;
    }
}

// Initialize chatbot when DOM is loaded
(function() {
    'use strict';
    console.log('[Bootstrap] IIFE start');
    
    function initializeChatbot() {
        console.log('[Bootstrap] initializeChatbot called');
        try {
            window.chatbot = new CollegeChatbot();
            console.log('✅ College Chatbot initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize chatbot:', error);
        }
    }

    if (document.readyState === 'loading') {
        console.log('[Bootstrap] document in loading state, attaching DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', initializeChatbot);
    } else {
        console.log('[Bootstrap] document ready, initializing immediately');
        initializeChatbot();
    }
    console.log('[Bootstrap] IIFE end');
})();
