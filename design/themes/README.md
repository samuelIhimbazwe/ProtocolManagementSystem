# PMSS UI themes

Two visual options for the same layouts and flows.

| Theme | File | Description |
|-------|------|-------------|
| **Option A** (default) | [`option-a.json`](option-a.json) | Navy + forest green — current production baseline |
| **Option B** | [`option-b.json`](option-b.json) | Cream `#F7F7F5`, black CTAs, gold `#C4A035`, taupe `#8C7B6B` |

## Switch in the app

**Settings → UI theme** (top of the Settings page; saved in `localStorage` as `pmss-ui-theme`).

## Restore Option A only in code

Set `document.documentElement.dataset.theme = 'a'` or clear `pmss-ui-theme` in localStorage.

Implementation: `prototype/src/theme/tokens.css` + `ThemeContext.jsx`.
