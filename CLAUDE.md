# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (uni-app) for offline mahjong chip settlement. It supports real-time multi-device room creation, chip tracking, and intelligent settlement with minimal transaction calculations.

**Tech Stack**: uni-app (Vue 3), Vuex, WeChat Cloud Development (Cloud Database + Cloud Functions + Real-time Push)

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (WeChat Mini Program)
npm run dev:mp-weixin

# Build for production
npm run build:mp-weixin
```

After running dev/build, open the `dist/dev/mp-weixin` or `dist/build/mp-weixin` directory in WeChat Developer Tools.

## WeChat Cloud Development Setup

**Environment ID**: Configured in [src/App.vue:7](src/App.vue#L7) - `wx.cloud.init({ env: 'cloud1-0ghl3glb04b742fc' })`

**Cloud Collections Required**:
- `rooms` - Room information with indexes on `roomCode` (unique) and TTL index on `expireAt` (2 hour expiration)
- `games` - Game records with indexes on `roomCode` and `createdAt`
- `players` - Player information (optional) with index on `openId`

**Cloud Functions** (in `cloud/` directory):
- `createRoom` - Generate unique 4-digit room code and create room
- `joinRoom` - Join existing room (validates capacity and status)
- `saveRound` - Save round results and update player chips
- `submitScore` - Submit scores for current round
- `submitScoreForTest` - Test version of score submission
- `login` - Handle user login
- `initiateEndGameVote` - Start voting to end game
- `voteEndGame` - Process end game votes
- `checkVoteTimeout` - Check for vote timeouts

Deploy cloud functions by right-clicking the `cloud/` directory in WeChat Developer Tools and selecting "Upload and Deploy: Cloud Installation".

## Architecture

### State Management (Vuex)

Store is located in [src/store/](src/store/) with two modules:

- **players** ([src/store/modules/players.js](src/store/modules/players.js)) - Manages player list with mutations for SET_PLAYERS, ADD_PLAYER, UPDATE_PLAYER, DELETE_PLAYER
- **games** ([src/store/modules/games.js](src/store/modules/games.js)) - Manages currentRoom, currentGame, and gameHistory

### Page Structure

Defined in [src/pages.json](src/pages.json):

1. **index** - Home page
2. **room/create** - Create room with initial chip settings
3. **room/join** - Join room by 4-digit code
4. **room/lobby** - Room lobby (waits for 4 players, auto-starts when full)
5. **game/record** - Record scores with chip balance validation
6. **game/settlement** - Round settlement results
7. **game/finalSettlement** - Final settlement when game ends

### Core Utilities

Located in [src/utils/](src/utils/):

- **settlement.js** - Settlement algorithm
  - `calculateSettlement(scores, playerMap)` - Greedy algorithm to minimize transaction count
  - `validateScores(scores)` - Zero-sum game validation (total must equal 0)
- **roomCode.js** - Room code generation and validation
- **storage.js** - Local storage wrapper

### Game Flow

1. **Room Creation**: Host sets nickname and initial chips (500/1000/2000/custom), system generates 4-digit room code
2. **Joining**: Players enter room code and nickname, room auto-starts when 4 players join
3. **Score Recording**:
   - Display current chips for each player
   - Input win/loss amounts for the round
   - Real-time validation that total equals 0 (zero-sum)
   - Preview chips after round
   - Detect if any player has chips ≤ 0
4. **Settlement**: Use greedy algorithm to calculate minimum transactions
5. **Game End**: Triggered when any player's chips ≤ 0, shows final rankings and profit/loss

### Key Features

- **Chip Tracking**: Each player starts with initial chips (set by host), updated after each round
- **Balance Validation**: Enforces zero-sum constraint (all scores must sum to 0)
- **Smart Settlement**: Minimizes number of transactions using greedy matching algorithm
- **Real-time Sync**: Uses WeChat Cloud Database real-time push for multi-device synchronization
- **Auto-expiration**: Rooms expire after 2 hours (TTL index on `expireAt` field)

## Important Notes

- This is a WeChat Mini Program - it can only run in WeChat Developer Tools or WeChat app
- Cloud functions use `wx-server-sdk` and must be deployed to WeChat Cloud
- Room codes are 4-digit numbers (1000-9999) with uniqueness validation
- The settlement algorithm in [src/utils/settlement.js](src/utils/settlement.js) uses a greedy approach: sorts creditors (positive scores) and debtors (negative scores), then matches them to minimize transactions
- All chip amounts should be validated to ensure zero-sum before settlement

## Testing

Test in WeChat Developer Tools:
1. UI and navigation testing
2. Local storage testing
3. Cloud function testing (requires cloud environment)

Multi-device testing requires at least 2 devices to test room creation, joining, and real-time synchronization.
