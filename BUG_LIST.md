# PrimeShift - Known Issues & Bug Tracking Log

This document tracks identified bugs, root causes, regression impact, and resolution status for the PrimeShift platform.

---

### Bug #001: Duplicate Card Rendering on Task Creation

- **Status**: **RESOLVED & VERIFIED**
- **Date Reported**: 2026-10-14
- **Severity**: Medium
- **Component**: `BoardView.jsx` (`handleCreateCard`) & `server/routes/boardRoutes.ts` (`POST /api/cards/new`)
- **Reported Behavior**:
  When creating a new board and subsequently adding new cards/tasks into a column, two identical card entries appeared in the UI instead of one. When attempting to delete one of the cards, both duplicate cards disappeared simultaneously.

#### Root Cause Analysis
1. **Concurrent Insertion via Socket & HTTP Response**:
   When a user created a new task, `handleCreateCard` dispatched a `POST /api/cards/new` request. The backend immediately broadcasted a `card:created` event over Socket.io to the entire board room (`board:${boardId}`), including the originating client socket.
2. **Missing Originating Socket Exclusion**:
   The Socket.io server emitted the broadcast to all connected sockets without excluding the sender's socket ID (`socketRef.current.id`).
3. **Unchecked State Append**:
   The client's socket listener (`socket.on('card:created')`) received the event and added the card to local state. A split-second later, the HTTP `fetch` promise resolved, and `setCards((prev) => [...prev, data.card])` blindly appended the exact same card entity a second time.
4. **Cascade Deletion**:
   Because both duplicate UI cards shared the identical primary key (`card.id`), triggering a delete action filtered out `c.id !== cardId`, removing both rendered elements from state simultaneously.

#### Resolution Applied
1. **Sender Socket Exclusion**:
   Updated `handleCreateCard` to pass `socketId: socketRef.current?.id` in the `POST /api/cards/new` request body. The server's `broadcastCardCreated(board_id, card, socketId)` now excludes the sender's socket, eliminating duplicate network events on the creator's client.
2. **Idempotent State Ingestion**:
   In `handleCreateCard`, the local state update now verifies uniqueness before insertion:
   ```typescript
   setCards((prev) => {
     if (prev.some((c) => c.id === data.card.id)) return prev;
     return [...prev, data.card];
   });
   ```
3. **Defensive Render Deduplication**:
   In `BoardView.tsx`, the card filtering logic now deduplicates cards by their unique ID:
   ```typescript
   const uniqueCards = Array.from(new Map(cards.map((c) => [c.id, c])).values());
   ```

---

### Bug #002: Replicated Sample Labels on New Boards and Missing In-Board Label Editing

- **Status**: **RESOLVED & VERIFIED**
- **Date Reported**: 2026-10-14
- **Severity**: Medium
- **Component**: `server/db.ts`, `server/routes/boardRoutes.ts`, `BoardView.tsx`, `CardModal.tsx`
- **Reported Behavior**:
  New boards were seeded with the identical sample labels as the initial demo board rather than fresh board-specific labels. Furthermore, users could not add, edit, or customize labels directly within the board interface.
- **Root Cause Analysis**:
  1. `createBoard` in `server/db.ts` generated identical hardcoded labels without allowing custom starter sets or isolating the sample board's domain labels.
  2. The frontend lacked a board-level label management modal and an inline label editor inside the card view.
  3. Real-time WebSocket handlers for `labels:updated` were not wired up in `BoardView.tsx`.
- **Resolution Applied**:
  1. Isolated sample board labels (`VIP Banquet`, `Dietary / Allergy`, `Kitchen Prep`, `HACCP & Sanitation`, `Beverage & Wine`, `Equipment Maint`) with explicit card assignments in `seedInitialData`.
  2. Defined distinct starter labels (`To Prep`, `Chef Special`, `Urgent Action`, `Inspection Ready`) with unique IDs for newly created boards.
  3. Added full Board Labels Management Modal accessible from the Board Settings dropdown ("Labels (customize text & colors)").
  4. Added inline label creation, name/color editing, and deletion directly inside `CardModal.tsx`.
  5. Implemented real-time `labels:updated` WebSocket broadcast and client handlers to sync label updates immediately across all viewing users.
  6. Enforced that all users with board access (Admin, Manager, Member, Viewer) have full rights to manage board labels.

---
