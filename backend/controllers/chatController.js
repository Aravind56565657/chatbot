const aiService = require('../services/geminiService');
const sessionStore = require('../services/sessionStore');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

/**
 * Handle chat requests with persistent state tracking.
 */
exports.handleChat = async (req, res, next) => {
  const { sessionId, message } = req.body;

  try {
    const session = sessionStore.getSession(sessionId);

    let services = [];
    let doctors = [];
    if (global.isMongoConnected) {
      services = await Service.find({ isActive: true });
      doctors = await Doctor.find({ isActive: true });
    } else {
      services = global.mockServices;
      doctors = [];
    }

    // Pass the ENTIRE session object (which includes lastStep) to AI
    const aiResponse = await aiService.processUserMessage(
      message,
      session.conversationHistory,
      { ...session.extractedData, lastStep: session.lastStep, intent: session.intent },
      services,
      doctors
    );

    // DEBUG LOG
    console.log("------------------- AI DEBUG -------------------");
    console.log("INTENT:", aiResponse.intent);
    console.log("ACTION:", aiResponse.action);
    console.log("NEXT STEP:", aiResponse.nextStep);
    console.log("SAVING LAST STEP:", aiResponse.nextStep);
    console.log("------------------------------------------------");

    // Save history
    session.conversationHistory.push({ role: 'user', text: message });
    session.conversationHistory.push({ role: 'assistant', text: aiResponse.responseMessage, isBot: true });

    // Update session data WITH lastStep persistence
    sessionStore.updateSession(sessionId, {
      extractedData: { ...session.extractedData, ...aiResponse.extractedData },
      intent: aiResponse.intent,
      lastStep: aiResponse.nextStep // CRITICAL: Save lastStep for next turn
    });

    const updatedSession = sessionStore.getSession(sessionId);
    const lowerMessage = message.toLowerCase();
    
    // Modification logic
    if (lowerMessage.includes("modify") || lowerMessage.includes("restart") || lowerMessage.includes("change")) {
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null });
        aiResponse.responseMessage = "I've cleared your details. Let's start over. Which specialty would you like to book?";
        aiResponse.nextStep = "show_service_buttons";
        return res.json(aiResponse);
    }

    const confirmationKeywords = ['yes', 'confirm', 'sure', 'book', 'fine', 'okay', 'correct', 'right', 'cancel it', 'proceed'];
    const isConfirming = confirmationKeywords.some(kw => lowerMessage.includes(kw));

    const shouldBook = (aiResponse.action === "booking_confirmed") || 
                      (aiResponse.action === "confirm_booking" && isConfirming);
    
    const shouldCancel = (aiResponse.action === "cancellation_confirmed") ||
                        (aiResponse.action === "confirm_cancellation" && isConfirming);

    if (shouldBook) {
      const data = updatedSession.extractedData;
      const bookingId = `APT-${Math.floor(1000 + Math.random() * 9000)}`;

      if (global.isMongoConnected) {
        const appointment = new Appointment({
          bookingId,
          service: data.serviceCategory || "General Consult",
          serviceCategory: data.serviceCategory || "General",
          date: new Date(data.date || new Date()),
          timeSlot: data.timeSlot || "09:00 AM",
          userName: data.userName || "Guest",
          userPhone: data.userPhone || "0000000000",
          userAge: data.userAge,
          userGender: data.userGender,
          doctorName: data.doctorName,
          doctorId: data.doctorId,
          userEmail: data.userEmail,
          sessionId: sessionId,
          status: 'confirmed'
        });

        await appointment.save();
        aiResponse.bookingData = appointment;
      }
      aiResponse.action = "booking_confirmed";
      aiResponse.responseMessage = `Excellent! Your appointment with ${data.doctorName} is successfully secured. Ref: ${bookingId}.`;
      sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null });
    }

    if (shouldCancel) {
        if (global.isMongoConnected) {
            const phone = updatedSession.extractedData?.userPhone;
            if (phone) {
               await Appointment.deleteMany({ userPhone: phone, status: 'confirmed' });
            }
        }
        aiResponse.action = "cancellation_confirmed";
        aiResponse.responseMessage = "Your appointment has been successfully removed from our records.";
        sessionStore.updateSession(sessionId, { extractedData: {}, lastStep: null });
    }

    res.json(aiResponse);
  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ responseMessage: "I encountered an error. Could we try that again?" });
  }
};
