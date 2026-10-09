# UI verification

## Design direction

Reading this as a focused photo tool and practical campaign workspace for mobile participants and campaign organizers. The visual language uses warm neutral surfaces, precise typography, charcoal dark mode, and one functional green accent. Dials: ENERGY 2 / RHYTHM 2 / MOTION 1.

Major decisions:

- Color: neutral surfaces keep uploaded templates visually dominant; green marks primary actions, focus, and active navigation.
- Layout: the public editor gives most space to the canvas; dashboard pages use a compact work navigation and content-led layouts.
- Typography: the system sans stack avoids another font request, stays readable in Indonesian, and uses weight and proportion for hierarchy.
- Spacing: an eight-pixel-derived scale separates controls, task groups, and pages without making mobile screens sparse.
- Surfaces: borders define work areas; shadows are limited to the canvas, auth panel, home action panel, and dialogs where elevation has meaning.
- Radius: six to sixteen pixels distinguishes controls, grouped surfaces, and elevated containers. Not every element is pill-shaped.
- Theme: light, dark, and system choices share the same hierarchy and are persisted without storing user photos.
- Motion: only short interaction transitions are used and reduced-motion preferences disable them.

`DESIGN.md` supplies the charcoal, functional green, compact typography, and touch-oriented direction. Proprietary fonts, Spotify branding, album-player layouts, forced dark mode, uppercase button copy, heavy shadows everywhere, and universal pill geometry were intentionally not copied.

## Automated evidence

- `npm run lint`: ESLint for frontend, tests, and scripts.
- `npm test`: editor geometry, transforms, image signatures, EXIF orientation, rendering order, limits, and analytics isolation.
- `npm run test:e2e`: public editor, local-photo privacy, export resolution, gestures, caption fallback, auth copy and forms, campaign lifecycle, statistics, moderation controls, themes, breakpoints, keyboard interactions, dialogs, loading, empty, and error routes.
- `npm run test:production`: repeats browser tests against the compiled site with Vercel CSP and security headers.
- `npm run test:security`: transactional RLS and permission matrix, rolled back after execution.
- `npm run test:live`: isolated Auth, Storage, Edge Function, publication, moderation, analytics, and deletion flow against the linked Supabase project. Generated test accounts and assets are removed.
- `npm run check:edge`: Deno checks all Edge Function entry points.
- `supabase db lint --linked --level warning`: PostgreSQL schema lint.

Playwright captures the reviewed states under ignored `test-results/`: homepage, login, registration mobile, editor before and after photo selection, empty campaign dashboard, campaign form mobile, superadmin users, dashboard themes, and not-found state.

Contrast was calculated rather than estimated. Primary text, secondary text, accents, errors, focus, and interactive boundaries meet their applicable WCAG AA thresholds in both themes. Automated viewport checks cover 320, 390, 700, 900, and 1280 pixels plus 200% text size.

## Anti-slop Delivery Gate

- Hard Gate PASS: no fabricated UI data or claims ship; no dead navigation; all shipped controls have behavior; data views include loading, empty, and error handling; focus is visible; dialogs close with Escape; mobile overflow checks pass.
- Purpose Gate PASS: no gradients, glow, decorative icons, generic illustrations, glass surfaces, or template animation stacks. Shadows and bordered surfaces are used only for task grouping and elevation.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 is consistent; canvas and page title provide focal points; whitespace structures tasks; green is the single accent; compact labels and offset work surfaces form the identity motif.
- Craftsmanship PASS: layouts follow actual tasks; CTAs name their actions; copy is concise Indonesian; light and dark themes are both tested; the design does not clone the reference products.
- UI supplement PASS: controls, states, responsive reflow, theme contrast, and mobile touch targets were exercised in Chromium.
- Copy supplement PASS: no promotional filler, fictional proof, decorative emoji, banned buzzwords, or em dash appears in application copy.
- Human supplement PASS: labels, status announcements, keyboard operation, focus, contrast, 200% text, and 320-pixel reflow are covered.
- Mobile supplement PASS: editor controls stack for one-handed use, dashboard navigation scrolls safely, targets are at least 44 pixels, and no page-wide horizontal overflow was detected.
- Code-comment supplement PASS: comments retain only non-obvious security, browser, or privacy constraints.

## Manual release checks

Real Safari, iPhone, Android, screen readers, production email delivery, and an authorized staging load test are not emulated by the local Chromium suite. Run those checks before a public launch. Vercel deployment itself is not performed by the test suite.
