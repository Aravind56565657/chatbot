/**
 * Simple in-memory session store
 */
const sessions = new Map();

exports.getSession = (sessionId) => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      conversationHistory: [],
      extractedData: {
        service: null,
        serviceCategory: null,
        date: null,
        timeSlot: null,
        userName: null,
        userPhone: null,
        userEmail: null,
        notes: null,
        bookingId: null,
        newDate: null,
        newTimeSlot: null
      },
      intent: null,
      // Persist the last deterministic state so the state machine can advance steps.
      lastStep: null,
      lastUpdated: new Date()
    });
  }
  return sessions.get(sessionId);
};

exports.updateSession = (sessionId, data) => {
  const session = exports.getSession(sessionId);
  
  if (data.extractedData) {
    // Deep merge or update non-null fields
    Object.keys(data.extractedData).forEach(key => {
      if (data.extractedData[key] !== null) {
        session.extractedData[key] = data.extractedData[key];
      }
    });
  }
  
  if (data.conversationHistory) {
    session.conversationHistory = data.conversationHistory;
  }
  
  if (data.intent) {
    session.intent = data.intent;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'lastStep')) {
    session.lastStep = data.lastStep;
  }
  
  session.lastUpdated = new Date();
  sessions.set(sessionId, session);
  return session;
};

exports.clearSession = (sessionId) => {
  sessions.delete(sessionId);
};

// Cleanup old sessions (e.g., older than 24 hours) every hour
setInterval(() => {
  const expiry = 24 * 60 * 60 * 1000;
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastUpdated > expiry) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);
