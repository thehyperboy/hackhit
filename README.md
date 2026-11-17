# HackhIt ⚡

> **Collegiate Hackathon Discovery, Coding Games Arena & Campus Community Platform**

HackhIt is a modern, neo-brutalist web application designed for university students, campus organizers, and competitive developers. Discover verified campus hackathons, compete in live browser-based coding battle games, climb the collegiate leaderboard, and recruit teammates across universities.

---

## 🌟 Key Features

### 1. 🔍 Campus Hackathons Discovery (`#explore`)
- **Real-World Architecture**: 100% genuine hackathons created by university organizers.
- **Search & Filter**: Search by title, organizer, city, or tech domain (AI/ML, Web, Blockchain, Data Science).
- **Mode Filters**: Filter by Online, Offline, or Hybrid events.
- **Direct Registration**: Clean registration modal with individual and team formation workflows.

### 2. ⚔️ Coding Games Arena & Collegiate Leaderboard (`#hackathons`)
- **6 Battle Arenas**:
  - *Speed Syntax Racer* (Speed & Accuracy)
  - *Bug Hunter Blitz* (Concurrency & Logic Debugging)
  - *1v1 Algorithm Duel* (Optimal Time/Space Complexity)
  - *SQL Detective* (Database Queries & Analytics)
  - *CSS Battle Arena* (Pixel-matching UI Layouts)
  - *Terminal Typer* (Bash & Systems Automation)
- **Live In-Browser Quick Sprint**: Playable rapid coding challenge directly in the browser with real-time score and XP feedback.
- **Collegiate Leaderboard**: Verified student rankings with Elo ratings, win rates, and university tags.

### 3. 👥 Campus Community Feed (`#community`)
- **Teammate Finder**: Post hackathon ideas, request collaborators (frontend, backend, AI/ML, designers), and assemble teams.
- **Engagement**: Like, comment, and inspect collaborator profiles directly.

### 4. 🎓 Student Profile & Organizer Dashboard
- **Student Profile (`#profile`)**: Showcase technical skills, campus affiliation, bio, social links, and registered events.
- **Organizer Dashboard (`#organizer`)**: Campus clubs and departments can create, publish, and manage verified hackathons.

### 5. 📱 Mobile-First Responsive Design
- Ergonomic sticky bottom navigation bar with 5 thumb-friendly quick actions (Home, Explore, Arena, Community, Profile).
- Touch-optimized card layouts, accessible contrast, and zero horizontal scrolling issues.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Lucide React Icons
- **Backend**: Supabase (PostgreSQL, Supabase Auth, Row-Level Security)
- **Tooling**: Oxlint, TypeScript Compiler (`tsc`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/thehyperboy/hackhit.git
   cd hackhit
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```
   *(Refer to `.env.example` for reference)*

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

5. **Production Build**:
   ```bash
   npm run build
   ```

---

## 📄 License

MIT © [KOUSHIK AILA](https://github.com/thehyperboy)
