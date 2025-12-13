// Configuration
// Priority: 1. APP_CONFIG (from config.js), 2. localStorage, 3. empty
const getApiBaseUrl = () => {
    // Look for config.js to obtain configuration
    if (window.APP_CONFIG && window.APP_CONFIG.isConfigured()) {
        return window.APP_CONFIG.API_BASE_URL;
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('apiBaseUrl');
    if (stored && stored !== 'https://YOUR-FUNCTION-APP.azurewebsites.net') {
        return stored;
    }
    
    return '';
};

let API_BASE_URL = getApiBaseUrl();

// Global state
let allBookings = [];
let filteredBookings = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Log configuration for debugging
    console.log('API Configuration:', {
        fromConfig: window.APP_CONFIG?.API_BASE_URL,
        fromStorage: localStorage.getItem('apiBaseUrl'),
        isConfigured: window.APP_CONFIG?.isConfigured(),
        finalUrl: API_BASE_URL
    });
    
    initializeApp();
    setupEventListeners();
    setDefaultDates();
});

function initializeApp() {
    // Check if API URL is configured
    if (!API_BASE_URL) {
        showConfigModal();
    } else {
        checkApiConnection();
        loadBookings();
    }
}

function setupEventListeners() {
    // Booking form submission
    document.getElementById('bookingForm').addEventListener('submit', handleBookingSubmit);
    
    // Search form submission
    document.getElementById('searchForm').addEventListener('submit', handleSearchSubmit);
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    // Set default dates
    document.getElementById('date').value = tomorrow;
    document.getElementById('searchDate').value = tomorrow;
    document.getElementById('filterDate').value = '';
    
    // Set default times
    document.getElementById('startTime').value = '09:00';
    document.getElementById('endTime').value = '11:00';
    document.getElementById('searchStart').value = '14:00';
    document.getElementById('searchEnd').value = '16:00';
}

// API Connection Check
async function checkApiConnection() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings`);
        
        if (response.ok) {
            statusDot.classList.add('online');
            statusText.textContent = 'Connected to Azure';
        } else {
            throw new Error('API unreachable');
        }
    } catch (error) {
        statusDot.classList.add('offline');
        statusText.textContent = 'Offline - Check configuration';
        console.error('Connection error:', error);
        showAlert('error', 'Unable to connect to the API. Check configuration.');
    }
}

// Create Booking
async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    // Disable button and show loader
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    
    const booking = {
        roomId: document.getElementById('roomId').value,
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        professorName: document.getElementById('professorName').value,
        course: document.getElementById('course').value,
        notes: document.getElementById('notes').value || ''
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(booking)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlert('success', `Booking created successfully! Room ${booking.roomId} reserved for ${booking.date}`);
            document.getElementById('bookingForm').reset();
            setDefaultDates();
            loadBookings();
            updateStats();
        } else {
            throw new Error(data.error || 'Error creating booking');
        }
    } catch (error) {
        console.error('Booking error:', error);
        showAlert('error', `Error: ${error.message}`);
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Load Bookings
async function loadBookings(filters = {}) {
    const bookingsList = document.getElementById('bookingsList');
    bookingsList.innerHTML = '<div class="loading">⏳ Loading bookings...</div>';
    
    try {
        let url = `${API_BASE_URL}/api/bookings`;
        const params = new URLSearchParams();
        
        if (filters.roomId) params.append('roomId', filters.roomId);
        if (filters.date) params.append('date', filters.date);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Unable to load bookings');
        }
        
        const data = await response.json();
        allBookings = data.bookings || [];
        filteredBookings = allBookings;
        
        renderBookings(filteredBookings);
        updateStats();
    } catch (error) {
        console.error('Load bookings error:', error);
        bookingsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Error loading bookings</div>
            </div>
        `;
    }
}

// Render Bookings
function renderBookings(bookings) {
    const bookingsList = document.getElementById('bookingsList');
    
    if (bookings.length === 0) {
        bookingsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">No bookings found</div>
            </div>
        `;
        return;
    }
    
    // Sort by date and time
    bookings.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
    });
    
    bookingsList.innerHTML = bookings.map(booking => `
        <div class="booking-item">
            <div class="booking-header">
                <div class="booking-room">🏛️ ${booking.roomId}</div>
                <button class="booking-delete" onclick="deleteBooking('${booking.id}')" title="Delete booking">
                    🗑️
                </button>
            </div>
            <div class="booking-info">
                <div><strong>📅 Date:</strong> ${formatDate(booking.date)}</div>
                <div><strong>🕐 Time:</strong> ${booking.startTime} - ${booking.endTime}</div>
                <div><strong>👨‍🏫 Professor:</strong> ${booking.professorName}</div>
                <div><strong>📚 Course:</strong> ${booking.course}</div>
                ${booking.notes ? `<div><strong>📝 Notes:</strong> ${booking.notes}</div>` : ''}
            </div>
        </div>
    `).join('');
}

// Delete Booking
async function deleteBooking(bookingId) {
    if (!confirm('Are you sure you want to delete this booking?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showAlert('success', 'Booking deleted successfully');
            loadBookings();
            updateStats();
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Error while deleting');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showAlert('error', `Error: ${error.message}`);
    }
}

// Search Available Rooms
async function handleSearchSubmit(e) {
    e.preventDefault();
    
    const date = document.getElementById('searchDate').value;
    const startTime = document.getElementById('searchStart').value;
    const endTime = document.getElementById('searchEnd').value;
    
    const resultsContainer = document.getElementById('availableRooms');
    const roomsList = document.getElementById('roomsList');
    
    resultsContainer.style.display = 'block';
    roomsList.innerHTML = '<div class="loading">Searching available rooms...</div>';
    
    try {
        const url = `${API_BASE_URL}/api/rooms/available?date=${date}&startTime=${startTime}&endTime=${endTime}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Error searching rooms');
        }
        
        const data = await response.json();
        const rooms = data.rooms || data.availableRooms || [];
        
        console.log('API Response:', data);
        console.log('Available rooms:', rooms);
        
        if (rooms.length === 0) {
            roomsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">😞</div>
                    <div class="empty-state-text">No rooms available for this time</div>
                </div>
            `;
        } else {
            roomsList.innerHTML = rooms.map(room => `
                <div class="room-item">
                    <div class="room-name">✅ ${room.id}</div>
                    <div class="room-capacity">👥 Capacity: ${room.capacity} seats</div>
                    ${room.hasProjector ? '<div class="room-feature">📽️ Projector available</div>' : ''}
                    ${room.isLab ? '<div class="room-feature">💻 Lab</div>' : ''}
                </div>
            `).join('');
            
            showAlert('success', `✅ Found ${rooms.length} available rooms!`);
        }
    } catch (error) {
        console.error('Search error:', error);
        roomsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">Search error: ${error.message}</div>
            </div>
        `;
    }
}

// Apply Filters
function applyFilters() {
    const roomFilter = document.getElementById('filterRoom').value;
    const dateFilter = document.getElementById('filterDate').value;
    
    filteredBookings = allBookings.filter(booking => {
        if (roomFilter && booking.roomId !== roomFilter) return false;
        if (dateFilter && booking.date !== dateFilter) return false;
        return true;
    });
    
    renderBookings(filteredBookings);
}

// Update Stats
function updateStats() {
    const totalBookings = allBookings.length;
    const today = new Date().toISOString().split('T')[0];
    
    const todayBookings = allBookings.filter(b => b.date === today).length;
    
    // Calculate active rooms (rooms in use right now)
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const activeRooms = allBookings.filter(b => {
        if (b.date !== today) return false;
        return b.startTime <= currentTime && b.endTime >= currentTime;
    }).length;
    
    document.getElementById('totalBookings').textContent = totalBookings;
    document.getElementById('todayBookings').textContent = todayBookings;
    document.getElementById('activeRooms').textContent = activeRooms;
}

// Alert System
function showAlert(type, message) {
    const alertBox = document.getElementById('alertBox');
    const alertIcon = document.getElementById('alertIcon');
    const alertMessage = document.getElementById('alertMessage');
    
    alertBox.className = `alert ${type}`;
    alertIcon.textContent = type === 'success' ? '✅' : '❌';
    alertMessage.textContent = message;
    alertBox.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        closeAlert();
    }, 5000);
}

function closeAlert() {
    const alertBox = document.getElementById('alertBox');
    alertBox.style.display = 'none';
}

// Configuration Modal
function showConfigModal() {
    const modal = document.getElementById('configModal');
    modal.classList.add('show');
    
    const input = document.getElementById('apiUrlInput');
    input.value = API_BASE_URL;
    input.focus();
}

function closeConfigModal() {
    const modal = document.getElementById('configModal');
    modal.classList.remove('show');
}

function saveApiUrl() {
    const url = document.getElementById('apiUrlInput').value.trim();
    
    if (!url) {
        alert('Enter a valid URL');
        return;
    }
    
    // Remove trailing slash if present
    API_BASE_URL = url.replace(/\/$/, '');
    
    // Save to localStorage
    localStorage.setItem('apiBaseUrl', API_BASE_URL);
    
    closeConfigModal();
    showAlert('success', 'Configuration saved! Connecting to API...');
    
    // Reinitialize
    checkApiConnection();
    loadBookings();
}

// Format Date for Display
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

// Handle Enter key in API URL input
document.addEventListener('DOMContentLoaded', () => {
    const apiUrlInput = document.getElementById('apiUrlInput');
    if (apiUrlInput) {
        apiUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveApiUrl();
            }
        });
    }
});

// Add keyboard shortcut to open config (Ctrl/Cmd + K)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        showConfigModal();
    }
});