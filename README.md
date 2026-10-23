# RoxCrew — Crew & Task Operations Kanban

RoxCrew is a crew operations and task management platform built for hospitality teams, venues, contractors, and project groups. It streamlines team collaboration, task accountability, assignment tracking, and rapid crew onboarding via secure QR codes and invite links.

---

## 🚀 Key Features

1. **Global User Roles & Secure Authentication**
   - **Roles**: Admin / Group Owner, Manager, and Staff.
   - **Authentication**: Secure JWT sessions stored in HttpOnly cookies with Bcrypt password hashing.
   - **Master Evaluator / Test Account**: `admin@test.com` with password `admin`.
   - **Domain-Based Auto-Joining**: Managers and staff automatically join their organization workspace based on their work email domain without manual typing.

2. **Crew Onboarding (QR Codes & Invite Links)**
   - No email SMTP required. Managers can generate instant invite links and QR codes directly from board settings.
   - New crew members scan the QR code or open `/join/:token` to sign up and instantly join the designated board with pre-configured roles.

3. **Card Images & File Storage**
   - Users can upload up to 5 photos per card (e.g. maintenance issues, event prep, inventory conditions).
   - Profile photos and custom board wallpapers can be uploaded (PNG/JPG, max 1MB limit).

4. **Real-Time Collaboration & Clickable Activity Feeds**
   - Instant live synchronization across devices using **Socket.io**.
   - High-level, descriptive activity logging (e.g. `"[User] commented on [Card]"`, `"[User] moved card..."`).
   - **Clickable Activities**: Click any activity item to instantly navigate to and open that card.

5. **Board Views, Wallpapers & UX Enhancements**
   - Streamlined board wallpaper uploader with Cover and Repeat toggle.
   - Click-outside backdrop support on all popups/modals to discard unsubmitted changes.
   - Direct JSON import from Trello exports.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Motion, `qrcode.react`.
- **Backend**: Node.js (tsx), Express 4, Socket.io, `multer`, JSON Web Tokens, Bcrypt.
- **Database**: Persistent JSON file store (`data/database.json`) managed by an in-memory `DatabaseStore` class.

---

## ⚙️ Getting Started & Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   The application will start on **Port 3000** (`http://localhost:3000`).

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

---

## 👥 Default Test Accounts

You can test the application using the master test account:
- **Master Admin / Owner**: `admin@test.com` / `admin`

Once logged in as `admin@test.com`, you can test permissions and switch between **Admin**, **Manager**, and **Staff** views using the built-in role switcher in the header.
