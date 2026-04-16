<div align="center">

<img src="https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/Frontend-Vercel-black?style=for-the-badge&logo=vercel" />
<img src="https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render" />
<img src="https://img.shields.io/badge/AI-Gemini_2.0_Flash-4285F4?style=for-the-badge&logo=google" />
<img src="https://img.shields.io/badge/DB-MongoDB-47A248?style=for-the-badge&logo=mongodb" />

# 🏥 Elite Concierge — AI Appointment Booking System

**A production-ready, conversational appointment booking system with a natural language chat interface and a real-time admin dashboard.**

🔗 **Live Demo:** [chatbot-black-mu-96.vercel.app](https://chatbot-black-mu-96.vercel.app)

</div>

---

## 📋 Table of Contents

1. [Abstract](#-1-abstract)
2. [Spec & Plan](#-2-spec--plan)
3. [Implementation](#-3-implementation)
4. [Edge Cases](#-4-edge-cases)

---

## 🧠 1. Abstract

**Elite Concierge** is a full-stack, AI-powered appointment booking system designed for medical and wellness clinics. Users interact with a conversational chat interface to book, reschedule, cancel, or check their appointments — no forms, no dropdowns, just natural language.

### The Core Idea

Traditional booking systems force users through rigid multi-step forms. This system replaces that with a chat-first experience: the user talks, the AI listens, and the system reacts intelligently — filling in data step by step through conversation.

### Why It's Different

| Traditional System | Elite Concierge |
|---|---|
| Static forms with 10+ fields | Conversational, one question at a time |
| Breaks on unexpected input | Deterministic fallback + AI safety net |
| No context memory | Session-scoped state machine |
| Frontend-only validation | Backend persistence + conflict detection |

### What It Does

- **Book appointments** — specialty → doctor → date → slot → patient details → confirmation
- **Cancel appointments** — lookup by phone or booking ID → double-confirm → cancel
- **Reschedule appointments** — find appointment → pick new date → pick slot → confirm
- **Check availability** — browse open slots without committing to a booking
- **My Bookings** — view all appointments by phone number with quick-action shortcuts
- **General Inquiry** — answer questions about prices, hours, doctors, and location

---

## 📐 2. Spec & Plan

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   USER (Browser)                    │
│               React + Tailwind + Vite               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (axios)
                       │ VITE_API_URL
┌──────────────────────▼──────────────────────────────┐
│              EXPRESS BACKEND (Render)               │
│                                                     │
│  ┌─────────────────┐   ┌──────────────────────┐    │
│  │  State Machine  │──▶│  Gemini AI (fallback) │    │
│  │  (deterministic)│   │  gemini-2.0-flash-exp │    │
│  └────────┬────────┘   └──────────────────────┘    │
│           │                                         │
│  ┌────────▼────────┐   ┌──────────────────────┐    │
│  │  Session Store  │   │  MongoDB / In-Memory  │    │
│  │  (in-memory)    │   │  (Atlas or fallback)  │    │
│  └─────────────────┘   └──────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite | SPA chat & admin UI |
| **Styling** | Tailwind CSS v3 | Utility-first responsive design |
| **Animations** | Framer Motion | Message transitions, card reveals |
| **Backend** | Node.js + Express 5 | REST API + session management |
| **AI** | Google Gemini 2.0 Flash | NLP fallback for unstructured input |
| **Database** | MongoDB + Mongoose | Persistent appointment storage |
| **Deployment** | Vercel + Render | Frontend + Backend hosting |

### Intent Flow Map

```
User Input
    │
    ├── "Book Appointment"      → specialty → doctor → date → slot → name → age → gender → phone → email → confirm → saved
    │
    ├── "Check Availability"    → specialty → doctor → date → view slots (read-only) → option to book
    │
    ├── "Cancel Appointment"    → lookup (phone / booking ID) → find card → double-confirm → cancelled
    │
    ├── "Reschedule"           → lookup → find card → new date → new slot → confirm → updated
    │
    ├── "My Bookings"          → phone → list of bookings → [ Cancel | Reschedule ] shortcut per card
    │
    └── "General Inquiry"      → topic picker → info card OR freeform → AI answers → end options
```

### API Design

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Main chat endpoint — processes message, returns next step |
| `GET` | `/api/appointments` | List all appointments (paginated, filterable) |
| `POST` | `/api/appointments` | Create appointment manually (admin) |
| `PUT` | `/api/appointments/:id` | Update appointment fields |
| `PUT` | `/api/appointments/:id/cancel` | Cancel a specific appointment |
| `PUT` | `/api/appointments/:id/reschedule` | Reschedule with new date + time |
| `POST` | `/api/appointments/find-by-phone` | Look up appointments by phone number |
| `GET` | `/api/appointments/find-by-id/:id` | Look up by booking reference ID |
| `GET` | `/api/appointments/availability` | Get taken slots for a doctor on a date |
| `GET` | `/api/doctors` | List doctors, filterable by category |
| `GET` | `/api/services` | List available services |
| `GET` | `/health` | Health check — reports DB connection status |

### Environment Variables

**Backend (Render):**

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/appointment_booking
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=https://your-app.vercel.app
PORT=5000  # set automatically by Render
```

**Frontend (Vercel):**

```env
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## ⚙️ 3. Implementation

### Frontend Structure

```
frontend/src/
├── api/
│   └── index.js               # Axios client — all API calls in one place
├── components/
│   ├── admin/
│   │   ├── AppointmentsTable.jsx  # Sortable, filterable data table
│   │   ├── BookingFormModal.jsx   # Manual booking creation modal
│   │   └── StatusBadge.jsx        # Colour-coded appointment status
│   └── chat/
│       ├── MessageBubble.jsx      # Chat bubble (bot / user variants)
│       ├── QuickReplies.jsx       # Tap-to-send option buttons
│       ├── DoctorCardRow.jsx      # Horizontal doctor selector cards
│       ├── SlotGrid.jsx           # Time slot picker grid
│       ├── BookingConfirmCard.jsx # Pre-booking review card
│       ├── AppointmentFoundCard.jsx   # Found appointment display
│       ├── CancellationConfirmCard.jsx # Cancel double-confirm
│       ├── RescheduleConfirmCard.jsx   # Reschedule summary
│       ├── AppointmentListCard.jsx    # My Bookings list view
│       ├── InquiryCard.jsx        # Prices / hours / location info cards
│       └── TypingIndicator.jsx    # Animated "..." while waiting
├── pages/
│   ├── ChatPage.jsx           # Main chat interface + intent state
│   └── AdminPage.jsx          # Admin dashboard
└── index.css                  # Global styles, glassmorphism tokens
```

### Backend Structure

```
backend/
├── controllers/
│   ├── chatController.js      # Orchestrates message → state machine → AI → DB
│   └── appointmentController.js # CRUD + cancel/reschedule/availability logic
├── services/
│   ├── geminiService.js       # State machine + Gemini AI fallback
│   └── sessionStore.js        # In-memory session map (sessionId → state)
├── models/
│   ├── Appointment.js         # Mongoose schema: booking data + status
│   ├── Doctor.js              # Doctor profile + specialty
│   └── Service.js             # Service catalog
├── routes/
│   ├── chat.js
│   ├── appointments.js
│   ├── doctors.js
│   └── services.js
├── middleware/
│   └── errorHandler.js        # Centralised error responses
├── seed.js                    # Populates doctors + services into MongoDB
└── server.js                  # App entry + CORS + MongoDB connection
```

### The State Machine (Core Logic)

The most critical design decision was **not to rely on AI for every step**.

```
User Message
     │
     ▼
runStateMachine(message, sessionData)
     │
     ├── Returns a result? ──────► Return it directly (fast, reliable)
     │
     └── Returns null? ──────────► callAI(message, history, context)
                                        │
                                        ├── AI returns valid JSON? ──► Return AI result
                                        │
                                        └── AI fails / quota? ──────► Safe fallback response
```

**Why this matters:** AI models can be slow, quota-limited, or return malformed JSON. The state machine handles 95% of all interactions deterministically — AI is only ever a fallback for truly unstructured freeform input (e.g. "Something Else" questions).

### Chat Session Lifecycle

```
1. sessionId generated client-side (UUID, stored in localStorage)
2. Every message sent with sessionId → /api/chat
3. Backend retrieves session from in-memory store
4. State machine runs → session updated → response stored back
5. Frontend receives { nextStep, action, extractedData, responseMessage }
6. ChatPage renders the appropriate component based on nextStep/action
```

### Conflict Detection

Appointments are checked for time-slot conflicts before saving:

```javascript
// Availability endpoint checks existing bookings for same doctor + date
GET /api/appointments/availability?doctorId=...&date=...
// Returns: { takenSlots: ["9:00AM", "11:00AM"] }
// SlotGrid.jsx greys out taken slots automatically
```

### Admin Dashboard

- **Live sync** of all bookings from MongoDB
- Filterable by status (Pending / Confirmed / Cancelled)
- Manual booking creation via modal form
- Status update and deletion in-table
- Falls back gracefully if the backend is cold-starting (Render free tier)

---

## 🛡️ 4. Edge Cases

### Input & Parsing

| Scenario | How It's Handled |
|---|---|
| User types a booking ID mid-flow (e.g. `APT-2231`) | `extractBookingId()` regex detects it and shortcuts straight to `fetch_by_id`, skipping the lookup-method step |
| User says "tomorrow" / "next Friday" / "April 25" | `detectDate()` handles relative, weekday, and `Month Day` formats — returns ISO `yyyy-MM-dd` |
| User enters phone with spaces/dashes (`810 620 8529`) | Normalized with `msg.replace(/\D/g, '')` before length check |
| Invalid email entered | Checked with `includes('@') && includes('.')` — re-prompts if invalid |
| User sends empty message | Blocked client-side with `!input.trim()` check before API call |

### Network & Backend

| Scenario | How It's Handled |
|---|---|
| Render backend cold-start (free tier ~30s delay) | Frontend shows typing indicator indefinitely; no timeout crash |
| MongoDB Atlas unreachable | Server boots in **In-Memory Mode** — all booking data stored in `global.mockAppointments` for the session |
| Gemini API quota exceeded (429) | Key rotation: multiple `GEMINI_API_KEY_*` env vars tried in sequence; `gemini-1.5-flash-latest` tried as fallback model |
| Gemini returns non-JSON or truncated response | `text.substring(s, e+1)` extracts only the JSON block; parse failure falls through to safe default |
| CORS blocked origin | `allowedOrigins` whitelist — only Vercel URL and localhost are permitted |

### Booking Flow

| Scenario | How It's Handled |
|---|---|
| User tries to book an already-taken slot | SlotGrid fetches live availability and disables taken slots visually |
| User clicks "Modify Details" on confirm card | Flow restarts from `show_service_buttons` preserving session intent |
| User navigates away mid-booking and returns | `sessionId` persists in `localStorage`; session state restored from server |
| User clicks "Cancel" from My Bookings | `cancelFromMyBookings` flag set → after cancel, refreshes the My Bookings list (not Main Menu) |
| User reschedules from My Bookings | `rescheduleFromMyBookings` flag → after confirm, returns to updated My Bookings list |

### Mobile & UI

| Scenario | How It's Handled |
|---|---|
| Input bar hidden by iOS home indicator | `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| Floating button overlapping input on small screens | Removed floating button; Main Menu moved to persistent header |
| Long doctor/service names overflowing cards | `min-w-0` + `truncate` / `flex-shrink-0` on all flex containers |
| User resizes browser mid-session | All layouts are responsive with Tailwind breakpoints (`xs`, `sm`, `lg`) |

### State Machine Guard Rails

| Scenario | How It's Handled |
|---|---|
| User mid-flow clicks a top-level intent button | `resetFlowData()` clears all partial data before starting new intent |
| State machine loses track of current step | Default `return reply(data, 'ask_lookup_method', ...)` re-anchors the flow |
| AI returns an intent that conflicts with session | State machine result always takes priority over AI; AI only runs when machine returns `null` |
| "Main Menu" sent at any point in any flow | Intercept before any other logic: re-renders welcome message, clears state |

---

## 🚀 Local Setup

```bash
# 1. Clone
git clone https://github.com/Aravind56565657/chatbot.git
cd chatbot

# 2. Backend
cd backend
npm install
# Create a .env file (see .env.example)
node seed.js        # Seed doctors & services
node server.js      # Starts on :5000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev         # Starts on :5173
```

Create a `.env` file in `backend/`:

```env
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=your_key_here
FRONTEND_URL=http://localhost:5173
```

---

## 📦 Deployment

| Service | Platform | Config |
|---|---|---|
| Frontend | Vercel | Root dir: `frontend` · Build: `vite build` · Env: `VITE_API_URL` |
| Backend | Render | Root dir: `backend` · Start: `node server.js` · Env: `MONGODB_URI`, `GEMINI_API_KEY`, `FRONTEND_URL` |

---

<div align="center">

Made with ❤️ · Powered by **Google Gemini** · Deployed on **Vercel + Render**

</div>
