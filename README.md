# English Department Dashboard

English Department Dashboard is a React and Supabase web app for managing lecturer records, course plotting, academic terms, and public tutor profile lookup. It was built for the Universitas Terbuka English Department, but the structure can be adapted for any department that needs to coordinate tutor availability, expertise, and course assignments.

The app has two main experiences:

- Public Mode lets tutors search their profile by tutor ID without signing in.
- Login Mode lets administrators manage lecturers, courses, terms, plotting, imports, exports, and dashboard infographics.

The project also includes an isolated demo account with dummy data for presentation use. Demo mode does not save to Supabase and does not alter existing production data.

## Features

- Lecturer directory with ID, degree, full name, email, phone, expertise, availability, and plotted courses.
- Admin-managed lecturer labels for teaching performance rating and warning notes.
- Dashboard infographics for degree, expertise, plotted course count, availability, and average plotted courses per lecturer.
- Course plotting by course or by lecturer.
- Term-based plotting, so the same lecturer database can be reused across academic terms.
- CSV/XLSX import and export for lecturers and plotting data.
- Import behavior that updates missing lecturer details without wiping existing plotted courses.
- Public tutor profile lookup by ID.
- Mobile-friendly controls, floating navigation, filter dials, and search modal.
- Built-in demo account for presentations.

## Tech Stack

- React 19
- Vite 8
- Tailwind CSS 4
- Recharts
- Framer Motion
- Supabase REST API and Auth

## Project Structure

```text
department-dashboard/
|-- public/
|   |-- favicon.svg
|   `-- icons.svg
|-- src/
|   |-- App.jsx
|   |-- features/
|   |   |-- AuthScreens.jsx
|   |   |-- CatalogFeatures.jsx
|   |   |-- DirectoryFeatures.jsx
|   |   `-- Plotting.jsx
|   |-- lib/
|   |   |-- autoPilot.js
|   |   |-- database.js
|   |   `-- importExport.js
|   |-- main.jsx
|   `-- index.css
|-- supabase-public-profile-views.sql
|-- supabase-lecturer-labels.sql
|-- supabase-term-plottings.sql
|-- supabase-course-class-plans.sql
|-- index.html
|-- package.json
`-- vite.config.js
```

`src/App.jsx` owns application state and synchronization orchestration. Authentication, feature screens, plotting, database access, import review, and auto-plotting rules are separated into the `features` and `lib` modules. Styling is mostly handled through Tailwind utility classes plus mobile overrides in `src/index.css`.

## Requirements

Install these before starting:

- Node.js 20 or newer
- npm
- A Supabase project, if you want real authentication and database sync
- Git, if you plan to fork or deploy your own version

## Quick Start

1. Clone the repository.

```bash
git clone https://github.com/ardikardianto/dept.dashboard.git
cd dept.dashboard
```

2. Install dependencies.

```bash
npm install
```

3. Create a local environment file.

```bash
cp .env.example .env.local
```

If `.env.example` does not exist in your fork yet, create `.env.local` manually:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Start the development server.

```bash
npm run dev
```

5. Open the local app.

```text
http://127.0.0.1:5173/
```

## Demo Account

Use this account when you want to present or test the app without touching existing Supabase data:

```text
Email: demo@englishdept.test
Password: Demo@12345
```

You can also click the `Use demo account` button on the login page. Demo mode loads dummy lecturers, courses, terms, plotting rows, and class plans in memory. It bypasses Supabase loading and saving.

## Supabase Setup

The app expects four main tables:

- `lecturers`
- `courses`
- `academic_terms`
- `term_plottings`
- `course_class_plans`

Create the first three tables in Supabase SQL Editor if they do not already exist:

```sql
create table if not exists public.lecturers (
  id text primary key,
  degree text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  expertise jsonb not null default '[]'::jsonb,
  plotted jsonb not null default '[]'::jsonb,
  available integer not null default 0
);

create table if not exists public.courses (
  code text primary key,
  title text not null default '',
  credits integer not null default 0
);

create table if not exists public.academic_terms (
  code text primary key,
  name text not null default '',
  ay text not null default '',
  semester text not null default '',
  active boolean not null default false
);
```

Then run the provided term plotting SQL:

```bash
supabase-term-plottings.sql
```

This creates the `term_plottings` table and row-level security policies for authenticated users.

Run the class-plan SQL as well:

```bash
supabase-course-class-plans.sql
```

This moves planned class counts and exact class-to-lecturer assignments from browser-only storage into Supabase. Existing local plans are retained and uploaded after the table becomes available.

To store lecturer ratings and warning notes, run:

```bash
supabase-lecturer-labels.sql
```

The app stays backward-compatible if this SQL has not been run yet, but ratings and warning notes will not persist to Supabase until the columns exist.

Finally, run:

```bash
supabase-public-profile-views.sql
```

This creates public-safe views used by Public Mode:

- `public_lecturer_profiles`
- `public_courses`
- `public_academic_terms`
- `public_term_plottings`

These views allow anonymous users to access only the fields needed for tutor profile lookup.

## Authentication

Admin users sign in through Supabase Auth using email and password. To add an administrator:

1. Open Supabase.
2. Go to Authentication.
3. Create a user with email and password.
4. Give the user access to the project data through the row-level security policies.

The current SQL policies allow authenticated users to read and write term plotting rows. If you need stricter permissions, update the RLS policies before production use.

## Environment Variables

The app reads Supabase configuration from Vite environment variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never commit `.env.local`. It is already ignored by `.gitignore`.

## Data Model

### Lecturer

```js
{
  id: "02001234",
  degree: "Ph.D.",
  name: "Lecturer Name",
  email: "lecturer@example.com",
  phone: "08123456789",
  rating: 4,
  warning_note: "Needs coordination follow-up before extra classes.",
  expertise: ["English Linguistics", "Translation Studies"],
  plotted: ["BING4110", "BING4211"],
  available: 2
}
```

### Course

```js
{
  code: "BING4110",
  title: "Basic Reading",
  credits: 3
}
```

### Academic Term

```js
{
  code: "2025-2",
  name: "2025/2026 - Semester 2",
  ay: "2025/2026",
  semester: "Semester 2",
  active: true
}
```

### Term Plotting

```js
{
  id: "2025-2::02001234",
  term_code: "2025-2",
  lecturer_id: "02001234",
  plotted: ["BING4110"],
  available: 3
}
```

## Importing Data

The lecturer import supports CSV and XLSX files. Recommended columns:

```text
Lecturer_ID
Name
Degree
Email
Phone
Rating
Warning_Note
Expertise
Available_Slots
Plotted_Course_Codes
```

Important behavior:

- Existing lecturer plotting is preserved when importing profile updates.
- Availability can be updated through import without changing plotted courses.
- Duplicate lecturer IDs in the same import are merged before saving.
- Expertise can be separated with commas or semicolons.

The plotting import supports simple rows with only:

```text
ID
Course_Code
```

It also supports exported plotting rows that include class names such as `BING4110.1`.

## Development Commands

Run the app locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run linting:

```bash
npm run lint
```

Note: the current app may report existing lint issues from React compiler rules in `src/App.jsx`. The production build is the main verification command currently used for deployment readiness.

## Customizing For Another Department

To adapt this project:

1. Update department branding in `src/App.jsx`, especially the `department` constant.
2. Replace `public/favicon.svg` with your own icon.
3. Update `index.html` for the browser title.
4. Adjust degree and expertise options in `src/App.jsx`.
5. Replace demo data constants if you want presentation data for your own department.
6. Create your own Supabase project and run the SQL setup.
7. Add your Supabase URL and anon key to `.env.local`.
8. Deploy to Vercel, Netlify, or another static hosting provider.

## Deployment

For Vercel:

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Set the build command to:

```bash
npm run build
```

4. Set the output directory to:

```text
dist
```

5. Add the environment variables:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

6. Deploy.

## Security Notes

- Public Mode should use the public-safe Supabase views, not direct anonymous access to `lecturers`.
- Do not expose lecturer email or phone publicly unless your department explicitly approves it.
- Keep `.env.local` private.
- Review Supabase RLS policies before using the app with real institutional data.
- Demo mode is intended for presentations and local testing only.

## License

No license file is currently included. Add a license before distributing or open-sourcing your own fork.
