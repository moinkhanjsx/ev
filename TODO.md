# EV Helper PR Steps

## Setup (Complete)
- [x] Clone repo
- [x] npm run install-deps
- [x] Create server/.env (local Mongo)

## Run App
- [ ] Start MongoDB (localhost:27017 or Atlas URI in .env)
- [ ] `npm --prefix ev run dev`
  - Backend: http://localhost:5000
  - Frontend: http://localhost:5173

## Create PR
- [ ] `cd ev`
- [ ] `git checkout -b blackboxai/improvements`
- [ ] Add improvements (CI workflow, README, healthcheck)
- [ ] `git add . && git commit -m "feat: blackboxai improvements (CI, docs, health)"`
- [ ] `git push -u origin blackboxai/improvements`
- [ ] `gh pr create --title "BlackboxAI: Add CI, improve docs and health endpoint" --body "Improvements for maintainability"`
- [ ] Merge/review
