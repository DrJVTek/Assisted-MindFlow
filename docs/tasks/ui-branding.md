# Integrate brand: track logo assets, add favicon + app top bar

**Area:** ui · **Effort:** medium · **Depends on:** none

## Objective
Get the two untracked root brand images out of the repo root and properly into the frontend, set the browser favicon/title to MindFlow branding, and add a small app top bar that shows the logo + product name. Done = no stray PNGs at repo root, favicon and tab title are MindFlow, and a branded bar is visible above/over the canvas.

## Files to touch
- `E:/Projects/github/Assisted MindFlow/logo.png` — DELETE from repo root. It is byte-identical (md5 ae4cf15419e20c65c421eab445048ac7) to the already-tracked frontend/public/logo.png, so it is a pure duplicate — just remove it.
- `E:/Projects/github/Assisted MindFlow/Logo2.png` — MOVE to frontend/public/logo-full.png (this is the 1.4MB high-res version; rename to a clean lowercase name with no space). git rm the root copy after.
- `E:/Projects/github/Assisted MindFlow/frontend/index.html` — Change the favicon <link rel="icon"> href from "/vite.svg" to "/logo.png", and change <title>frontend</title> to <title>MindFlow</title>.
- `E:/Projects/github/Assisted MindFlow/frontend/src/components/Canvas.tsx` — Add a small branded top bar. The simplest in-canvas placement is a new React Flow <Panel position="top-center"> (next to the existing top-left zoom Panel at line ~1201 and top-right toolbar Panel at line ~1214) containing <img src="/logo.png"> + the word MindFlow. Use CSS tokens for colors (var(--panel-bg), var(--node-text)), never hardcoded hex.

## Steps
1. From repo root run: md5sum logo.png frontend/public/logo.png to re-confirm they are identical (expect the same hash ae4cf15419e20c65c421eab445048ac7). If they differ, STOP and ask — do not assume.
2. git rm the duplicate root logo: git rm logo.png (it stays available as frontend/public/logo.png, already tracked and served at /logo.png).
3. Move the hi-res image into the frontend public dir with a clean name: git mv "Logo2.png" frontend/public/logo-full.png  (note: Logo2.png is currently untracked, so plain `git mv` may fail; if it does, run `mv "Logo2.png" frontend/public/logo-full.png` then `git add frontend/public/logo-full.png`).
4. Edit frontend/index.html: replace <link rel="icon" type="image/svg+xml" href="/vite.svg" /> with <link rel="icon" type="image/png" href="/logo.png" /> and replace <title>frontend</title> with <title>MindFlow</title>.
5. Open frontend/src/components/Canvas.tsx and locate the existing zoom-level Panel (search for 'Zoom level display' around line 1200) and the toolbar Panel ('Toolbar buttons' around line 1213). Immediately after the zoom Panel, add a new <Panel position="top-center"> with style using ONLY CSS tokens: backgroundColor: 'var(--panel-bg)', color: 'var(--node-text)', display:'flex', alignItems:'center', gap:'8px', padding:'6px 12px', borderRadius:'6px', boxShadow: 'var(--shadow-md)'.
6. Inside that Panel put: <img src="/logo.png" alt="MindFlow" style={{ width: 22, height: 22, objectFit:'contain' }} draggable={false} /> and a <span style={{ fontWeight:700, letterSpacing:'-0.3px' }}>MindFlow</span>.
7. Confirm `Panel` is already imported from 'reactflow' in Canvas.tsx (it is used by the zoom + toolbar panels). If for some reason it is not in the import, add it — do NOT add a second import line.
8. Run the frontend build + app and visually confirm favicon, tab title, and the top-center brand bar.

## Acceptance criteria
- [ ] No *.png files remain untracked or tracked at the repo root (git status shows logo.png and Logo2.png gone from root).
- [ ] frontend/public/logo.png still exists and is served at /logo.png (watermark in Canvas.tsx line ~1011 still works).
- [ ] frontend/public/logo-full.png exists and is tracked by git.
- [ ] Browser tab shows title 'MindFlow' and the MindFlow logo as favicon (not the Vite logo).
- [ ] A top-center bar over the canvas shows the logo + 'MindFlow' text, themed via CSS tokens (no hardcoded hex), and looks correct in both light and dark theme.
- [ ] Frontend build passes and unit tests still pass.

## Verify
```
cd "E:/Projects/github/Assisted MindFlow" && git status   # expect NO logo.png / Logo2.png at root
ls "E:/Projects/github/Assisted MindFlow/frontend/public"   # expect logo.png AND logo-full.png
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run build
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run test
npm --prefix "E:/Projects/github/Assisted MindFlow/frontend" run dev   # open http://127.0.0.1:5173 — check favicon, tab title 'MindFlow', and top-center brand bar in both themes
```

## Gotchas
- The root logo.png is a DUPLICATE, not a new asset — do not copy it into public/ again, public/logo.png already exists and is referenced as /logo.png. Just delete the root one.
- Logo2.png and logo.png contain a SPACE-free path but the project root folder name is 'Assisted MindFlow' (has a space) — always quote paths in shell commands.
- The app currently has NO global header/top-bar component (App.tsx just renders <Canvas/>). Canvas content is React Flow; overlays are done with reactflow <Panel position=...>. Use a Panel rather than inventing a new DOM header, to stay consistent and keep it inside the flow viewport.
- Do NOT touch the existing watermark <img src="/logo.png"> at Canvas.tsx ~line 1010 — it is a separate, intentional faint background element.
- Commit atomically as e.g. `chore(015): move brand assets into frontend, add favicon + top bar`.
