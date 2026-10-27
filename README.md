# ArchScale Authentication Module

This repository contains the full authentication and session management module for the ArchScale platform (MERN stack with Supabase Auth as identity provider, MongoDB Atlas for tenancy and session state, React on Vercel, Node/Express on Railway).

## Project Structure

- `backend/`: Node.js / Express API with MongoDB Mongoose models, Supabase integration, session & device tracking, invite & registration workflows.
- `frontend/`: React + Vite SPA with custom responsive glassmorphic design system, session management, context/profile switcher, and admin invitation views.

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run seed     # Seeds super admin and admin accounts
npm run dev      # Runs Express server on port 5000 (or PORT env)
```

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev      # Runs Vite dev server on port 5173
```

## Production Deployment Guide

### A. Deploy Backend to Render

1. Log in to **[Render.com](https://render.com)** and click **New +** > **Web Service**.
2. Connect your Git repository (`archscale-authmodule`).
3. Configure the service settings:
   - **Name:** `archscale-auth-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Plan:** Free (or Starter)
4. Add the following **Environment Variables** in Render Dashboard:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `SUPABASE_URL`: Your Supabase Project URL (`https://ychhgouyckfpvrqpgdkr.supabase.co`)
   - `SUPABASE_ANON_KEY`: Your Supabase anon public key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role secret key
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g. `https://archscale.vercel.app`)
   - `COOKIE_SECRET`: 64-character random secret key
   - `OTP_ENCRYPTION_KEY`: 64-character random encryption key
   - `MAIL_PROVIDER_KEY`: Your Resend API key (`re_...`)
   - `MAIL_FROM`: `ArchScale Auth <onboarding@resend.dev>`
5. Click **Deploy Web Service**. Once live, your backend will be at:
   `https://archscale-auth-backend.onrender.com`
   (Healthcheck: `https://archscale-auth-backend.onrender.com/health`)

---

### B. Deploy Frontend to Vercel

1. Log in to **[Vercel.com](https://vercel.com)** and click **Add New...** > **Project**.
2. Import your Git repository (`archscale-authmodule`).
3. In the project setup:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. In **Environment Variables**, add:
   - `VITE_API_BASE_URL`: `https://archscale-auth-backend.onrender.com/api`
     *(Replace with your actual Render service URL)*
5. Click **Deploy**. Vercel will build and launch your application at `https://<your-project>.vercel.app`.
6. **Final Step:** Go back to your Render backend dashboard and ensure `FRONTEND_URL` matches your live Vercel domain (`https://<your-project>.vercel.app`).
