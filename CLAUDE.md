# PTO - Construction DocOps System

## Project Structure
- `frontend/` - React + Ant Design 5 + TypeScript (deployed on Vercel)
- `backend/` - Express + Prisma + PostgreSQL + TypeScript (deployed on Google Cloud VM)

## Tech Stack
- Frontend: React 18, Ant Design 5, Vite, TypeScript, i18next (TR/RU/EN)
- Backend: Express.js, Prisma ORM, PostgreSQL, JWT auth
- Storage: Local filesystem (./uploads) - not S3/MinIO

## Deployment
- **Frontend**: Vercel (auto-deploy from main branch)
- **Backend**: Google Cloud VM (n8n-server)
  - User: ahmetsamilyuksel
  - Path: ~/PTO/backend
  - Process manager: PM2 (service name: pto-backend)
  - Database: PostgreSQL 16 on localhost (database: pto_db, user: pto_user)
  - Port: 3000
  - Storage: Local filesystem at ./uploads

## After Backend Changes
When backend code is modified, the following must happen on the Google Cloud VM (SSH):
```bash
cd ~/PTO/backend
git pull origin <branch-name>
npm install        # only if dependencies changed
npm run build
pm2 restart pto-backend
```

## Demo Credentials
- Admin: ahmet@saela.ru / password123
- Site Chief: ivanov@saela.ru / password123
- Tech Supervisor: petrova@stroyinvest.ru / password123

## Development Notes
- Branch for current work: claude/fix-vercel-build-command-fgylG
- Mobile responsive: Tables use Ant Design `responsive` prop to hide columns on small screens
- All table pages have been optimized for mobile
- The user's language is Turkish (communicate in Turkish when needed)
