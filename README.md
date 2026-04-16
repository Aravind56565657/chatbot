# AI-Powered Appointment Booking System

A premium, production-ready appointment booking system featuring a natural language chat interface and a comprehensive admin dashboard.

## Features

- **AI Receptionist**: Talk naturally to book, reschedule, or cancel appointments. Powered by Claude 3.5 Sonnet.
- **Admin Dashboard**: Real-time management of all bookings with status tracking and manual creation.
- **Premium UI**: Dark-themed, glassmorphic design with smooth Framer Motion animations.
- **Conflict Management**: Prevents double bookings automatically.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, MongoDB
- **AI**: Anthropic Claude API
- **State**: In-memory session store + MongoDB persistence

## Setup Instructions

1. **Environment Variables**:
   Update the `.env` file in the root directory with your `ANTHROPIC_API_KEY`.

2. **Backend**:
   ```bash
   cd backend
   npm install
   node seed.js
   node server.js
   ```

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## API Endpoints

- `POST /api/chat`: Send message to AI assistant
- `GET /api/appointments`: List appointments (paginated)
- `POST /api/appointments`: Create manual booking
- `PUT /api/appointments/:id`: Update booking
- `DELETE /api/appointments/:id`: Cancel booking
- `GET /api/services`: List available services
