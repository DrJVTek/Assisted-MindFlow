# Polish canvas node visuals (typography, spacing, header, hover/selected) using CSS tokens

**Area:** ui · **Effort:** medium · **Depends on:** none

## Objective
Refine the inline styles of the canvas node card in frontend/src/components/Node.tsx so it has a clear typographic hierarchy, consistent spacing, a cleaner header, and distinct hover/selected states — using only var(--...) design tokens (never hardcoded hex). Done = node reads as a polished card in both light and dark mode, no raw hex literals remain in the node's chrome (header/border/shadow/text), and all existing functionality (ports, run button, status animations) still works.

## Files to touch
- `frontend/src/components/Node.tsx` — Replace hardcoded hex colors in the node container, title bar, port labels, and previews with CSS tokens; bump typography hierarchy and spacing per the step values below. Keep the root div className 'mindflow-node' so a CSS hover rule can target it.
- `frontend/src/index.css` — Add a `.mindflow-node:hover` rule (hover elevation/border) using existing tokens; do not introduce new hex.

## Steps
1. Open frontend/src/components/Node.tsx and read the render block (lines ~238-461). All target spots are inline `style={{...}}` objects on that JSX.
2. HEADER COLOR GOTCHA: the title bar background is `headerColor` (line ~311), which comes from `nodeTypeDef.ui.color` (the plugin's type color) — this is DATA, not chrome. Do NOT replace it with a token; it must stay the per-node-type color. Leave the white title text (line ~330 `color: 'white'`) and textShadow as-is — white maximizes contrast on an arbitrary plugin color.
3. CONTAINER (line ~241-262 style object): keep `backgroundColor: 'var(--node-bg)'`. Change `borderRadius: '6px'` -> `borderRadius: 'var(--radius-sm)'`. Replace hardcoded boxShadow values: selected branch currently `'0 0 0 1px #4FC3F7, 0 4px 12px rgba(79, 195, 247, 0.2)'` -> `'0 0 0 1px var(--primary-color), var(--shadow-md)'`; non-executing default `'0 2px 6px rgba(0, 0, 0, 0.2)'` -> `'var(--shadow-sm)'`. Leave the executing glow rgba (it matches the index.css node-pulse keyframes — it is an animation accent, not chrome).
4. CONTAINER border colors (line ~243): already use tokens (var(--primary-color), var(--danger-color), var(--success-color), var(--node-border)) — keep as-is, confirm no hex slipped in.
5. TYPOGRAPHY HIERARCHY: Title (line ~327-334) is fontSize '11px' fontWeight 600 -> bump to fontSize '12px', fontWeight 600, letterSpacing '0.01em'. Content preview (line ~431-441) keep fontSize '10px' and `color: 'var(--node-text-secondary)'`. Port labels (lines ~406-411 and ~417-422) fontSize '8px' -> '9px', keep `color: 'var(--node-text-muted)'`. Response preview (line ~447-454) keep fontSize '9px' italic + `var(--node-text-muted)`.
6. SPACING: title bar padding (line ~313) `'4px 10px'` -> `'6px 10px'` (keep minHeight TITLE_H). Body wrapper (line ~400) padding `'4px 8px 6px'` -> `'6px 8px 8px'` (keep gap '2px'). Content-preview block (lines ~437-439): keep `borderTop: '1px solid var(--node-border)'`; change `paddingTop: '3px'` -> 'var(--spacing-xs)'; keep `marginTop: '2px'`.
7. SELECTED vs HOVER distinction: selected already gets a primary 2px border + primary ring shadow. ADD a hover state via ONE of two routes — (A) PURE CSS (preferred): in frontend/src/index.css add `.mindflow-node:hover { border-color: var(--primary-color); box-shadow: var(--shadow-md); }`. The root div already has className 'mindflow-node'. CAVEAT: inline styles beat the class, so you must move the non-selected/non-executing DEFAULT borderColor/boxShadow OUT of inline (delete them from the inline ternaries' default branch) into the CSS class, otherwise :hover never applies. (B) JS hover: add `const [hovered,setHovered]=useState(false)` + onMouseEnter/Leave on the root div and fold `hovered` into the borderColor/boxShadow ternaries. Use A unless it tangles with executing/error/complete states; then fall back to B.
8. DESIGN DECISION (call out, do not invent): whether hover also lifts the node (translateY) is a taste call. Default to NO transform (avoids jitter during React Flow drag); only add `transform: translateY(-1px)` on hover if the reviewer asks.
9. After edits, search the file for `#` and confirm the ONLY remaining hex/rgba literals are the documented exceptions: (a) `FALLBACK_PORT_COLOR = '#90A4AE'` (data fallback, leave), (b) template-var port color `'#FFD54F'` (data, leave), (c) port `p.color` dots (data, leave), (d) the executing-glow rgba, (e) white header text. All structural border/shadow/radius/spacing must be var(--...) tokens.

## Acceptance criteria
- [ ] Node container border-radius, default box-shadow, and selected box-shadow use var(--radius-sm)/var(--shadow-*)/var(--primary-color) tokens — no raw hex in those properties.
- [ ] Title text is 12px/600 with slight letter-spacing; port labels are 9px; spacing around header and body increased per steps. Visual hierarchy reads title > content preview > ports/response.
- [ ] Hovering an unselected node changes border to var(--primary-color) and elevates shadow to var(--shadow-md); a selected node stays distinct (2px primary border + ring) and hover does not erase the selected look.
- [ ] Per-node-type header color (plugin ui.color) is unchanged and still drives the title bar background.
- [ ] Light AND dark mode both look correct (toggle theme in the running app); execution status animations (executing/complete/error) still fire.
- [ ] Remaining hex/rgba literals in Node.tsx are limited to the documented data/accent exceptions.

## Verify
```
cd frontend && npx tsc -b --noEmit  (must compile with 0 errors)
cd frontend && npm run lint  (no new lint errors in Node.tsx)
Run the app from repo root (restart.bat or run-frontend.bat), open http://127.0.0.1:5173 — confirm: (1) node card looks polished, (2) hover an unselected node shows border+shadow change, (3) selecting shows the primary ring, (4) toggle dark mode via Settings and re-check, (5) click the run button on a runnable node and confirm the executing glow still animates.
grep -n '#' frontend/src/components/Node.tsx  — confirm only the documented exceptions remain.
```

## Gotchas
- DO NOT tokenize `headerColor` / the title bar background — it is the plugin's per-type color (data), not theme chrome. Replacing it would make every node the same color.
- The executing-glow box-shadow rgba mirrors @keyframes node-pulse in index.css (lines ~225-228). Change one and the transition looks inconsistent — easiest is to leave the executing glow rgba as-is.
- Inline `style` always beats a CSS class for the same property. With the CSS-hover route (A) you MUST remove the conflicting static inline boxShadow/borderColor default, or the :hover rule silently won't apply.
- FALLBACK_PORT_COLOR '#90A4AE' (line ~66) and template-var color '#FFD54F' (line ~198) are data colors — leave them; they are not node chrome.
- Tokens --spacing-xs, --radius-sm, --shadow-sm/md, --primary-color exist in both :root and .dark in index.css — safe to use. There is no base text token for the title (it is white-on-header by design).
