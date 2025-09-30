// College Assistant Chatbot Application
class CollegeAssistant {
    constructor() {
        this.apiKey = 'AIzaSyDR-Bk7iVfJK9jA7HBnu4AyBVKReTiQsEc';
        this.sheetId = '1oAdQ-H2sOcQFzwMfX9LKMhoghUyhrXBPPd8gMLj7TQA';
        this.sheets = {
            timetable: 'timetable',
            attendance: 'attendance',
            messmenu: 'messmenu',
            events: 'events',
            contacts: 'contacts',
            subjects: 'subjects'
        };
        
        this.userRollNumber = null;
        this.conversationContext = [];
        this.isTyping = false;
        
        // Current date context: Tuesday, September 30, 2025, 1:40 PM IST
        this.currentDate = new Date('2025-09-30T13:40:00+05:30');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupQuickActions();
    }

    bindEvents() {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserInput();
            }
        });
        
        sendButton.addEventListener('click', () => {
            this.handleUserInput();
        });

        // Handle suggestion chips
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('chip')) {
                chatInput.value = e.target.textContent.replace(/[""]/g, '');
                this.handleUserInput();
            }
        });
    }

    setupQuickActions() {
        const quickButtons = document.querySelectorAll('.quick-btn');
        quickButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });
    }

    handleQuickAction(action) {
        const actionQueries = {
            'timetable': 'show my timetable',
            'classes-tomorrow': 'what classes do I have tomorrow',
            'attendance': 'show my attendance',
            'lunch-today': 'what is for lunch today',
            'events-today': 'what events are happening today',
            'contacts': 'show me department contacts',
            'help': 'help'
        };

        const query = actionQueries[action];
        if (query) {
            document.getElementById('chatInput').value = query;
            this.handleUserInput();
        }
    }

    async handleUserInput() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        input.value = '';
        this.addMessage(message, 'user');
        this.showTypingIndicator();
        
        try {
            const response = await this.processQuery(message);
            this.hideTypingIndicator();
            this.addMessage(response, 'bot');
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            console.error('Error processing query:', error);
        }
    }

    async processQuery(query) {
        // Store conversation context
        this.conversationContext.push(query);
        
        // Normalize query for processing
        const normalizedQuery = this.normalizeQuery(query);
        
        // Check if user is providing just a roll number (automatic detection)
        const rollNumberOnly = this.detectRollNumber(query.trim());
        if (rollNumberOnly) {
            this.userRollNumber = rollNumberOnly;
            return `Got it! I've saved your roll number as ${this.userRollNumber}. Now I can help with your personal queries like timetable, attendance, and more!`;
        }
        
        // Check if user is providing roll number with text
        const rollNumberMatch = query.match(/(?:my roll number is|roll number|roll no\.?)\s*([A-Z]+\d+)/i);
        if (rollNumberMatch) {
            this.userRollNumber = rollNumberMatch[1].toUpperCase();
            return `Great! I've saved your roll number as ${this.userRollNumber}. Now I can help you with personalized information like your timetable and attendance.`;
        }
        
        // Handle greetings
        if (this.isGreeting(normalizedQuery)) {
            return this.getGreetingResponse();
        }
        
        // Handle help requests
        if (this.isHelpRequest(normalizedQuery)) {
            return this.getHelpResponse();
        }
        
        // Handle various query types
        if (this.isTimetableQuery(normalizedQuery)) {
            return await this.handleTimetableQuery(normalizedQuery);
        }
        
        if (this.isAttendanceQuery(normalizedQuery)) {
            return await this.handleAttendanceQuery(normalizedQuery);
        }
        
        if (this.isMessMenuQuery(normalizedQuery)) {
            return await this.handleMessMenuQuery(normalizedQuery);
        }
        
        if (this.isEventsQuery(normalizedQuery)) {
            return await this.handleEventsQuery(normalizedQuery);
        }
        
        if (this.isContactsQuery(normalizedQuery)) {
            return await this.handleContactsQuery(normalizedQuery);
        }
        
        // Default response for unrecognized queries
        return this.getDefaultResponse(query);
    }

    // Enhanced roll number detection for standalone input
    detectRollNumber(text) {
        const rollPattern = /^[A-Z]+\d+$/i;
        const trimmed = text.trim();
        return rollPattern.test(trimmed) ? trimmed.toUpperCase() : null;
    }

    normalizeQuery(query) {
        return query.toLowerCase()
            .replace(/tommorrow|tommorow/, 'tomorrow')
            .replace(/attendence/, 'attendance')
            .replace(/timetabel|time table/, 'timetable')
            .replace(/\s+/g, ' ')
            .trim();
    }

    parseTimeExpression(query) {
        const today = new Date(this.currentDate); // Use a copy to avoid modifying the original

        // Yesterday
        if (/\byesterday\b/.test(query)) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - 1);
            return { date: targetDate, type: 'specific_date' };
        }

        // Today
        if (/\btoday\b/.test(query)) {
            return { date: today, type: 'specific_date' };
        }

        // Day after tomorrow
        if (/\bday after tomorrow\b/.test(query)) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + 2);
            return { date: targetDate, type: 'specific_date' };
        }

        // Tomorrow
        if (/\btomorrow\b/.test(query)) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + 1);
            return { date: targetDate, type: 'specific_date' };
        }

        // In X days
        const inDaysMatch = query.match(/in (\d+) days?/);
        if (inDaysMatch) {
            const days = parseInt(inDaysMatch[1]);
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + days);
            return { date: targetDate, type: 'specific_date' };
        }

        // X days ago
        const daysAgoMatch = query.match(/(\d+) days? ago/);
        if (daysAgoMatch) {
            const days = parseInt(daysAgoMatch[1]);
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - days);
            return { date: targetDate, type: 'specific_date' };
        }

        // Weekdays (last, this, next, on)
        const weekdayMatch = query.match(/(last|this|next|on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
        if (weekdayMatch) {
            const modifier = weekdayMatch[1];
            const weekday = weekdayMatch[2];
            let targetDate;

            if (modifier === 'last') {
                targetDate = this.getPreviousWeekday(today, weekday);
            } else if (modifier === 'next') {
                targetDate = this.getNextWeekday(today, weekday);
            } else { // 'this' or 'on' or no modifier
                targetDate = this.getCurrentOrNextWeekday(today, weekday);
            }
            return { date: targetDate, type: 'specific_date', weekday };
        }

        // Month-related queries (next jan, in january, etc.)
        const monthMatch = query.match(/(next|last|this)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
        if (monthMatch) {
            const modifier = monthMatch[1];
            const monthName = monthMatch[2];
            const monthIndex = this.getMonthIndex(monthName);
            let year = today.getFullYear();

            if (modifier === 'next' || (!modifier && monthIndex < today.getMonth())) {
                year++;
            } else if (modifier === 'last') {
                year--;
            }

            const targetMonth = new Date(year, monthIndex, 1);
            return { date: targetMonth, type: 'month', month: monthIndex, year };
        }

        // In X months
        const inMonthsMatch = query.match(/in (\d+) months?/);
        if (inMonthsMatch) {
            const months = parseInt(inMonthsMatch[1]);
            const targetDate = new Date(today);
            targetDate.setMonth(today.getMonth() + months);
            return { date: targetDate, type: 'month', month: targetDate.getMonth(), year: targetDate.getFullYear() };
        }

        // Next month
        if (/\bnext month\b/.test(query)) {
            const startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
            return { startDate, endDate, type: 'date_range', period: 'next month' };
        }

        // This month
        if (/\bthis month\b/.test(query)) {
            const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return { startDate, endDate, type: 'date_range', period: 'this month' };
        }

        // Last month
        if (/\blast month\b/.test(query)) {
            const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            return { startDate, endDate, type: 'date_range', period: 'last month' };
        }

        // Next week
        if (/\bnext week\b/.test(query)) {
            const startDate = new Date(today);
            startDate.setDate(today.getDate() + (7 - today.getDay()) + 1); // Next Monday
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // Following Sunday
            return { startDate, endDate, type: 'date_range', period: 'next week' };
        }

        // This week
        if (/\bthis week\b/.test(query)) {
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay() + 1); // This Monday
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // This Sunday
            return { startDate, endDate, type: 'date_range', period: 'this week' };
        }

        // Last week
        if (/\blast week\b/.test(query)) {
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay() - 6); // Last Monday
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // Last Sunday
            return { startDate, endDate, type: 'date_range', period: 'last week' };
        }

        return null; // No date expression found
    }

    getPreviousWeekday(currentDate, weekdayName) {
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetWeekday = weekdays.indexOf(weekdayName.toLowerCase());
        const currentWeekday = currentDate.getDay();

        let daysToSubtract = currentWeekday - targetWeekday;
        if (daysToSubtract <= 0) {
            daysToSubtract += 7;
        }

        const targetDate = new Date(currentDate);
        targetDate.setDate(currentDate.getDate() - daysToSubtract);
        return targetDate;
    }
    
    getCurrentOrNextWeekday(currentDate, weekdayName) {
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetWeekday = weekdays.indexOf(weekdayName.toLowerCase());
        const currentWeekday = currentDate.getDay();

        let daysToAdd = targetWeekday - currentWeekday;
        if (daysToAdd < 0) { // If the day has already passed this week, get next week's
            daysToAdd += 7;
        }

        const targetDate = new Date(currentDate);
        targetDate.setDate(currentDate.getDate() + daysToAdd);
        return targetDate;
    }

    getNextWeekday(currentDate, weekdayName) {
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetWeekday = weekdays.indexOf(weekdayName.toLowerCase());
        const currentWeekday = currentDate.getDay();
        
        let daysToAdd = targetWeekday - currentWeekday;
        if (daysToAdd <= 0) {
            daysToAdd += 7; // Move to next week
        }
        
        const targetDate = new Date(currentDate);
        targetDate.setDate(currentDate.getDate() + daysToAdd);
        return targetDate;
    }

    getCurrentWeekday(currentDate, weekdayName) {
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetWeekday = weekdays.indexOf(weekdayName.toLowerCase());
        const currentWeekday = currentDate.getDay();
        
        let daysToAdd = targetWeekday - currentWeekday;
        
        const targetDate = new Date(currentDate);
        targetDate.setDate(currentDate.getDate() + daysToAdd);
        return targetDate;
    }

    getMonthIndex(monthName) {
        const months = {
            'january': 0, 'jan': 0,
            'february': 1, 'feb': 1,
            'march': 2, 'mar': 2,
            'april': 3, 'apr': 3,
            'may': 4,
            'june': 5, 'jun': 5,
            'july': 6, 'jul': 6,
            'august': 7, 'aug': 7,
            'september': 8, 'sep': 8,
            'october': 9, 'oct': 9,
            'november': 10, 'nov': 10,
            'december': 11, 'dec': 11
        };
        
        return months[monthName.toLowerCase()] || 0;
    }

    formatDateForDisplay(date) {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('en-US', options);
    }

    isGreeting(query) {
        const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
        return greetings.some(greeting => query.includes(greeting));
    }

    isHelpRequest(query) {
        return query.includes('help') || query.includes('what can you do') || query.includes('how to use');
    }

    isTimetableQuery(query) {
        return query.includes('timetable') || query.includes('schedule') || query.includes('classes') || query.includes('class');
    }

    isAttendanceQuery(query) {
        return query.includes('attendance') || query.includes('present') || query.includes('absent');
    }

    isMessMenuQuery(query) {
        return query.includes('lunch') || query.includes('dinner') || query.includes('breakfast') || 
               query.includes('food') || query.includes('menu') || query.includes('meal') || query.includes('mess')|| query.includes('snacks')|| query.includes('snack');
    }

    isEventsQuery(query) {
        return query.includes('event') || query.includes('fest') || query.includes('function') || 
               query.includes('program') || query.includes('activity');
    }

    isContactsQuery(query) {
        return query.includes('contact') || query.includes('phone') || query.includes('number') || 
               query.includes('call') || query.includes('department');
    }

    async handleTimetableQuery(query) {
        if (!this.userRollNumber) {
            return 'I need your roll number to show your timetable. Please tell me your roll number like "My roll number is B24035" or just type your roll number.';
        }

        try {
            const timeInfo = this.parseTimeExpression(query);
            const data = await this.fetchSheetData('timetable');
            
            if (!data || data.length <= 1) {
                return 'Sorry, I couldn\'t fetch the timetable data right now. Please try again later.';
            }
            
            const userSchedule = data.filter(row => 
                row[0] && row[0].toString().toUpperCase() === this.userRollNumber
            );
            
            if (userSchedule.length === 0) {
                return `No timetable found for roll number ${this.userRollNumber}. Please check if your roll number is correct.`;
            }
            
            if (timeInfo && timeInfo.type === 'specific_date') {
                const dayName = this.getDayName(timeInfo.date);
                const daySchedule = userSchedule.filter(row => 
                    row[1] && row[1].toLowerCase() === dayName.toLowerCase()
                );
                
                if (daySchedule.length === 0) {
                    return `No classes scheduled for ${this.formatDateForDisplay(timeInfo.date)}.`;
                }
                
                return this.formatTimetableResponse(daySchedule, this.formatDateForDisplay(timeInfo.date));
            }
            
            return this.formatTimetableResponse(userSchedule, 'this week');
        } catch (error) {
            console.error('Error fetching timetable:', error);
            return 'Sorry, I couldn\'t fetch your timetable right now. Please try again later.';
        }
    }

    async handleMessMenuQuery(query) {
        try {
            const timeInfo = this.parseTimeExpression(query);
            const mealTime = this.extractMealTime(query);
            
            let targetDate = this.currentDate;
            let displayDate = 'today';
            
            if (timeInfo && timeInfo.type === 'specific_date') {
                targetDate = timeInfo.date;
                displayDate = this.formatDateForDisplay(targetDate);
            }
            
            const dayName = this.getDayName(targetDate);
            const data = await this.fetchSheetData('messmenu');
            
            // Handle case where API might fail or return no data
            if (!data || data.length === 0) {
                return this.getSampleMessMenuResponse(dayName, mealTime, displayDate);
            }
            
            // Find menu for the requested day
            const dayMenu = data.find(row => 
                row && row[0] && row[0].toLowerCase() === dayName.toLowerCase()
            );
            
            if (!dayMenu) {
                return this.getSampleMessMenuResponse(dayName, mealTime, displayDate);
            }
            
            return this.formatMessMenuResponse(dayMenu, displayDate, mealTime);
        } catch (error) {
            console.error('Error fetching mess menu:', error);
            const timeInfo = this.parseTimeExpression(query);
            let targetDate = this.currentDate;
            if (timeInfo && timeInfo.type === 'specific_date') {
                targetDate = timeInfo.date;
            }
            const dayName = this.getDayName(targetDate);
            const mealTime = this.extractMealTime(query);
            const displayDate = this.formatDateForDisplay(targetDate);
            return this.getSampleMessMenuResponse(dayName, mealTime, displayDate);
        }
    }

    getDayName(date) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[date.getDay()];
    }

    async handleEventsQuery(query) {
        try {
            const timeInfo = this.parseTimeExpression(query);
            const data = await this.fetchSheetData('events');
            
            if (!data || data.length <= 1) {
                return 'Sorry, I couldn\'t fetch events data right now. Please try again later.';
            }
            
            let filteredEvents = data.slice(1); // Remove header row
            
            if (timeInfo) {
                filteredEvents = this.filterEventsByTimeInfo(filteredEvents, timeInfo);
            }
            
            if (filteredEvents.length === 0) {
                const timeDesc = timeInfo ? this.getTimeDescription(timeInfo) : '';
                return timeDesc ? `No events found for ${timeDesc}.` : 'No upcoming events found.';
            }
            
            const timeDesc = timeInfo ? this.getTimeDescription(timeInfo) : '';
            return this.formatEventsResponse(filteredEvents, timeDesc);
        } catch (error) {
            console.error('Error fetching events:', error);
            return 'Sorry, I couldn\'t fetch events data right now. Please try again later.';
        }
    }

    // Enhanced contact filtering for individual contacts
    async handleContactsQuery(query) {
        try {
            const data = await this.fetchSheetData('contacts');
            
            if (!data || data.length <= 1) {
                return 'Sorry, I couldn\'t fetch contact information right now. Please try again later.';
            }
            
            // Check for specific contact requests
            const specificContact = this.findSpecificContact(query, data);
            if (specificContact) {
                return this.formatSpecificContactResponse(specificContact, query);
            }
            
            return this.formatContactsResponse(data);
        } catch (error) {
            console.error('Error fetching contacts:', error);
            return 'Sorry, I couldn\'t fetch contact information right now. Please try again later.';
        }
    }

    // Find specific individual contact
    findSpecificContact(query, contactsData) {
        const searchTerms = {
            'principal': ['principal', 'principal office', 'principal contact', 'principal number'],
            'medical': ['medical', 'medical room', 'medical contact', 'doctor', 'medical number', 'health'],
            'hostel': ['hostel', 'hostel warden', 'warden', 'hostel contact', 'hostel number', 'accommodation'],
            'library': ['library', 'librarian', 'library contact', 'library number'],
            'sports': ['sports', 'sports department', 'sports contact', 'sports number', 'gym'],
            'it': ['it', 'it department', 'computer', 'tech', 'technical'],
            'accounts': ['accounts', 'accounts office', 'finance', 'fees'],
            'admission': ['admission', 'admission office', 'admissions', 'enrollment']
        };
        
        const queryLower = query.toLowerCase();
        
        // Find matching department
        for (const [dept, terms] of Object.entries(searchTerms)) {
            if (terms.some(term => queryLower.includes(term))) {
                // Find contact in data
                const contact = contactsData.slice(1).find(row => 
                    row && row[0] && row[0].toLowerCase().includes(dept)
                );
                
                if (contact) {
                    return { department: contact[0], number: contact[1], searchTerm: dept };
                }
            }
        }
        
        return null;
    }

    formatSpecificContactResponse(contact, originalQuery) {
        return `<div class="event-card">
            <h4>📞 ${contact.department}</h4>
            <p><strong>Contact Number:</strong> <a href="tel:${contact.number}" target="_blank">${contact.number}</a></p>
            <p><em>You can call this number for any queries related to ${contact.department.toLowerCase()}.</em></p>
        </div>`;
    }

    filterEventsByTimeInfo(events, timeInfo) {
        if (timeInfo.type === 'specific_date') {
            const targetDateStr = timeInfo.date.toISOString().split('T')[0];
            return events.filter(event => {
                const eventDate = event[1];
                return eventDate && eventDate === targetDateStr.replace(/-/g, '-');
            });
        }

        if (timeInfo.type === 'month') {
            const targetYear = timeInfo.year;
            const targetMonth = timeInfo.month + 1; // Convert to 1-based

            return events.filter(event => {
                const eventDate = event[1];
                if (!eventDate) return false;

                const eventYear = new Date(eventDate).getFullYear();
                const eventMonth = new Date(eventDate).getMonth() + 1;

                return eventYear === targetYear && eventMonth === targetMonth;
            });
        }

        if (timeInfo.type === 'date_range') {
            const startDate = timeInfo.startDate;
            const endDate = timeInfo.endDate;

            return events.filter(event => {
                const eventDateStr = event[1];
                if (!eventDateStr) return false;

                const eventDate = new Date(eventDateStr);
                return eventDate >= startDate && eventDate <= endDate;
            });
        }

        return events;
    }

    getTimeDescription(timeInfo) {
        if (timeInfo.type === 'specific_date') {
            return this.formatDateForDisplay(timeInfo.date);
        }
        
        if (timeInfo.type === 'date_range') {
            return timeInfo.period;
        }
        
        if (timeInfo.type === 'month') {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            return `${monthNames[timeInfo.month]} ${timeInfo.year}`;
        }
        
        return '';
    }

    async fetchSheetData(sheetName) {
        const range = `${this.sheets[sheetName]}!A:Z`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${range}?key=${this.apiKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        return data.values || [];
    }

    extractMealTime(query) {
        if (query.includes('breakfast')) return 'breakfast';
        if (query.includes('lunch')) return 'lunch';
        if (query.includes('dinner') || query.includes('supper')) return 'dinner';
        if (query.includes('snack')) return 'snacks';
        return null;
    }

    getSampleMessMenuResponse(dayName, mealTime, displayDate) {
        const sampleMenus = {
            'monday': ['Monday', 'Poha, Tea', 'Rice, Dal, Sabji', 'Samosa, Tea', 'Roti, Paneer'],
            'tuesday': ['Tuesday', 'Upma, Coffee', 'Rice, Rajma', 'Pakora, Tea', 'Roti, Dal'],
            'wednesday': ['Wednesday', 'Idli, Coffee', 'Rice, Chicken Curry', 'Bread Pakora, Tea', 'Roti, Aloo Sabji'],
            'thursday': ['Thursday', 'Paratha, Curd', 'Rice, Fish Curry', 'Samosa, Tea', 'Roti, Dal Fry'],
            'friday': ['Friday', 'Dosa, Coffee', 'Biryani, Raita', 'Vada Pav, Tea', 'Roti, Paneer Masala'],
            'saturday': ['Saturday', 'Poha, Tea', 'Rice, Mutton Curry', 'Bhel Puri, Tea', 'Roti, Mixed Veg'],
            'sunday': ['Sunday', 'Chole Bhature', 'Special Thali', 'Pav Bhaji', 'Roti, Dal Makhani']
        };

        const dayKey = dayName.toLowerCase();
        const menu = sampleMenus[dayKey] || sampleMenus['monday'];
        
        return this.formatMessMenuResponse(menu, displayDate, mealTime);
    }

    async handleAttendanceQuery(query) {
        if (!this.userRollNumber) {
            return 'I need your roll number to check your attendance. Please tell me your roll number like "My roll number is B24035" or just type your roll number.';
        }

        try {
            const [attendanceData, subjectsData] = await Promise.all([
                this.fetchSheetData('attendance'),
                this.fetchSheetData('subjects')
            ]);

            if (!attendanceData || attendanceData.length <= 1) {
                return 'Sorry, I couldn\'t fetch attendance data right now. Please try again later.';
            }

            const subjects = subjectsData.flat();
            const subject = this.extractSubject(query, subjects);

            let userAttendance = attendanceData.filter(row =>
                row[0] && row[0].toString().toUpperCase() === this.userRollNumber
            );

            if (userAttendance.length === 0) {
                return `No attendance data found for roll number ${this.userRollNumber}.`;
            }

            if (subject) {
                userAttendance = userAttendance.filter(row =>
                    row[1] && row[1].toLowerCase() === subject.toLowerCase()
                );

                if (userAttendance.length === 0) {
                    return `No attendance data found for ${subject}.`;
                }
            }

            if (query.includes('enough attendance')) {
                return this.checkEnoughAttendance(userAttendance, subject);
            }

            return this.formatAttendanceResponse(userAttendance, subject);
        } catch (error) {
            console.error('Error fetching attendance:', error);
            return 'Sorry, I couldn\'t fetch your attendance right now. Please try again later.';
        }
    }

    extractSubject(query, subjects) {
        const lowerQuery = query.toLowerCase();
        for (const subject of subjects) {
            if (lowerQuery.includes(subject.toLowerCase())) {
                return subject;
            }
        }
        return null;
    }

    checkEnoughAttendance(attendance, subject) {
        const attendanceThreshold = 75;
        let response = '';

        if (subject) {
            const subjectAttendance = attendance[0];
            const percentage = parseInt(subjectAttendance[2]) || 0;
            if (percentage >= attendanceThreshold) {
                response = `Yes, you have ${percentage}% attendance in ${subject}, which is above the required ${attendanceThreshold}%.`;
            } else {
                response = `No, you have only ${percentage}% attendance in ${subject}, which is below the required ${attendanceThreshold}%.`;
            }
        } else {
            const averageAttendance = attendance.reduce((sum, row) => sum + (parseInt(row[2]) || 0), 0) / attendance.length;
            if (averageAttendance >= attendanceThreshold) {
                response = `Yes, your overall average attendance is ${averageAttendance.toFixed(1)}%, which is good.`;
            } else {
                response = `No, your overall average attendance is ${averageAttendance.toFixed(1)}%, which is below the required ${attendanceThreshold}%.`;
            }
        }
        return response;
    }

    formatTimetableResponse(schedule, period) {
        if (!schedule || schedule.length === 0) {
            return `No classes found for ${period}.`;
        }
        
        let html = `<p><strong>📅 Your timetable for ${period}:</strong></p>`;
        html += '<table class="data-table">';
        html += '<thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th></tr></thead>';
        html += '<tbody>';
        
        schedule.forEach(row => {
            html += `<tr>
                <td>${row[1] || 'N/A'}</td>
                <td>${row[2] || 'N/A'}</td>
                <td>${row[3] || 'N/A'}</td>
                <td>${row[4] || 'N/A'}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        return html;
    }

    formatAttendanceResponse(attendance, subject) {
        let html = `<p><strong>📊 Your attendance summary${subject ? ` for ${subject}` : ''}:</strong></p>`;
        html += '<table class="data-table">';
        html += '<thead><tr><th>Subject</th><th>Attendance %</th><th>Status</th></tr></thead>';
        html += '<tbody>';
        
        attendance.forEach(row => {
            const percentage = parseInt(row[2]) || 0;
            let statusClass = 'attendance-low';
            let status = 'Needs Improvement';
            
            if (percentage >= 75) {
                statusClass = 'attendance-high';
                status = 'Good';
            } else if (percentage >= 60) {
                statusClass = 'attendance-medium';
                status = 'Average';
            }
            
            html += `<tr>
                <td>${row[1] || 'N/A'}</td>
                <td class="${statusClass}">${percentage}%</td>
                <td class="${statusClass}">${status}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        
        const averageAttendance = attendance.reduce((sum, row) => sum + (parseInt(row[2]) || 0), 0) / attendance.length;
        html += `<p><strong>Overall Average:</strong> <span class="${averageAttendance >= 75 ? 'attendance-high' : averageAttendance >= 60 ? 'attendance-medium' : 'attendance-low'}">${averageAttendance.toFixed(1)}%</span></p>`;
        
        return html;
    }

    formatMessMenuResponse(menu, displayDate, mealTime) {
        let html = `<p><strong>🍽️ Mess menu for ${displayDate}:</strong></p>`;
        
        if (mealTime) {
            const mealIndex = {
                'breakfast': 1,
                'lunch': 2,
                'snacks': 3,
                'dinner': 4
            };
            
            const mealData = menu[mealIndex[mealTime]] || 'Not available';
            html += `<div class="event-card">
                <h4>${mealTime.charAt(0).toUpperCase() + mealTime.slice(1)}</h4>
                <p>${mealData}</p>
            </div>`;
        } else {
            const meals = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
            meals.forEach((meal, index) => {
                html += `<div class="event-card">
                    <h4>${meal}</h4>
                    <p>${menu[index + 1] || 'Not available'}</p>
                </div>`;
            });
        }
        
        return html;
    }

    formatEventsResponse(events, timeFrame) {
        let html = `<p><strong>🎉 ${timeFrame ? `Events for ${timeFrame}` : 'Upcoming Events'}:</strong></p>`;
        
        events.forEach(event => {
            html += `<div class="event-card">
                <h4>${event[0] || 'Event'}</h4>
                <p><strong>Date:</strong> ${event[1] || 'TBD'}</p>
                <p><strong>Time:</strong> ${event[2] || 'TBD'}</p>
                <p><strong>Venue:</strong> ${event[3] || 'TBD'}</p>
                <p><strong>Organizer:</strong> ${event[4] || 'N/A'}</p>
            </div>`;
        });
        
        return html;
    }

    formatContactsResponse(contacts) {
        let html = '<p><strong>📞 Department Contacts:</strong></p>';
        html += '<table class="data-table">';
        html += '<thead><tr><th>Department</th><th>Contact Number</th></tr></thead>';
        html += '<tbody>';
        
        contacts.slice(1).forEach(row => {
            html += `<tr>
                <td>${row[0] || 'N/A'}</td>
                <td><a href="tel:${row[1]}" target="_blank">${row[1] || 'N/A'}</a></td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        return html;
    }

    getGreetingResponse() {
        const greetings = [
            "Hello! How can I help you with your college information today?",
            "Hi there! I'm here to help with your timetable, attendance, mess menu, and more!",
            "Hey! What would you like to know about college today?",
            "Good to see you! Ask me anything about your classes, attendance, or campus events."
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    getHelpResponse() {
        return `<p><strong>Here's what I can help you with:</strong></p>
        <ul>
            <li><strong>📅 Timetables:</strong> "Show my timetable", "Classes tomorrow", "Classes day after tomorrow", "Next Monday classes"</li>
            <li><strong>📊 Attendance:</strong> "My attendance", "Show my attendance summary"</li>
            <li><strong>🍽️ Mess Menu:</strong> "What's for lunch today?", "Dinner day after tomorrow", "Menu next Monday"</li>
            <li><strong>🎉 Events:</strong> "Events today", "Events next week", "Events in January"</li>
            <li><strong>📞 Contacts:</strong> "Principal contact", "Medical contact", "Hostel warden number"</li>
        </ul>
        <p><strong>Time expressions I understand:</strong></p>
        <ul>
            <li>Today, tomorrow, day after tomorrow</li>
            <li>Next Monday, this Friday, next week</li>
            <li>On 25th next month, events in January</li>
            <li>In 2 days, 2 days later</li>
        </ul>
        <p><strong>Tips:</strong></p>
        <ul>
            <li>Just type your roll number (e.g., "B24035") to save it</li>
            <li>Use natural language: "What classes do I have day after tomorrow?"</li>
            <li>Ask for specific contacts: "Principal contact", "Medical number"</li>
        </ul>`;
    }

    getDefaultResponse(query) {
        return `I'm not sure how to help with "${query}". Try asking me about:
        <ul>
            <li>Your class timetable or schedule</li>
            <li>Attendance records</li>
            <li>Mess menu for meals</li>
            <li>Campus events and activities</li>
            <li>Department contact information</li>
        </ul>
        <p>You can also click on the quick action buttons above for common requests!</p>`;
    }

    addMessage(content, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = sender === 'bot' ? '🤖' : '👤';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = content;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        indicator.classList.add('show');
        this.isTyping = true;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        indicator.classList.remove('show');
        this.isTyping = false;
    }
}

// Initialize the chatbot when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CollegeAssistant();
});
