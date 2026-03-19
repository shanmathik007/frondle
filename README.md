# FRöNDLé 🎮

A lightweight social task app - turn activities into games with friends.

**Pure GitHub. Your data syncs to YOUR repo.**

## How It Works

1. **Fork this repo** → Get your own `username.github.io/frondle`
2. **Connect GitHub** → Paste a Personal Access Token
3. **Data syncs to your repo** → `data/*.json` files auto-commit
4. **Challenge friends** → Shared via GitHub Gists
5. **Mutual completion** → Both confirm = points!

## Features

- 🎯 **Task Challenges** - Propose activities to friends
- 🤝 **Dual Confirmation** - Both must mark done for credit
- 🔥 **Heat Meter** - Track friendship engagement
- 📊 **Points & Streaks** - Gamified progress
- 🎲 **Random Challenges** - Spin for spontaneous activities
- 🔄 **GitHub Sync** - Data persists in YOUR repository

## Data Storage

| Data | Location |
|------|----------|
| Your profile | `data/profile.json` in your repo |
| Your tasks | `data/tasks.json` in your repo |
| Friend list | `data/friends.json` in your repo |
| Shared tasks | GitHub Gist (both friends can edit) |

**Local fallback**: Works without GitHub (localStorage only, no sync)

## Quick Start

### 1. Fork & Deploy

1. Click **Fork** on this repo
2. Go to Settings → Pages → Source: `main` branch
3. Visit `https://YOUR_USERNAME.github.io/frondle`

### 2. Connect GitHub

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=repo,gist&description=FRöNDLé)
2. Create token with `repo` + `gist` scopes
3. Paste token in FRöNDLé
4. Done! Data now syncs to your repo

### 3. Add Friends

1. Share your invite code (or link)
2. Friend enters your code in their FRöNDLé
3. A shared Gist is created for task proposals
4. Challenge accepted!

## Tech Stack

- Pure HTML/CSS/JavaScript
- No build step
- No npm dependencies
- ~15KB total

## File Structure

```
frondle/
├── index.html          # Single page app
├── styles/
│   └── main.css        # All styles (~800 lines)
├── scripts/
│   ├── storage.js      # GitHub API + localStorage
│   ├── ui.js           # DOM helpers, rendering
│   └── app.js          # Main application logic
├── data/               # Created by app (in your repo)
│   ├── profile.json    # Your profile & stats
│   ├── tasks.json      # Task history
│   ├── friends.json    # Friend list
│   └── gists.json      # Shared gist IDs
└── README.md
```

## Invite Flow

```
You (alice.github.io/frondle)
  │
  ├─ Your code: ABC123
  │
  └─ Share: alice.github.io/frondle?invite=ABC123
                    │
                    ▼
        Friend opens link
        Creates their profile
        Enters your code ABC123
        You both have shared task bin!
```

## Contributing

1. Fork it
2. Make changes
3. Submit PR

## License

MIT - do whatever you want.

---

Built with ❤️ for friends who need motivation.
