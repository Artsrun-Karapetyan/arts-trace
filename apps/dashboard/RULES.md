# Dashboard Project Rules & Guidelines

Welcome to the dashboard project! To maintain a high-quality, scalable, and maintainable codebase, all developers and AI assistants must adhere to the following rules.

## 1. One Component Per File
**Never place more than one React component in a single file.**
If a component requires sub-components (e.g., a `TableRow` for a `Table`, or a `JsonNode` for a `JsonTree`), those sub-components must be extracted into their own individual files and imported.
*   **Why?** Improves readability, simplifies testing, and reduces merge conflicts.
*   **Exception:** Tiny wrapper components used exclusively inside a single parent component *might* be acceptable, but strict adherence is preferred.

## 2. Helper Functions Belong in `src/helpers/`
**No utility or helper functions should be defined inside component or route files.**
If a function does not return JSX and doesn't rely on React hooks, it is a helper.
*   **Action:** Move all data formatting, parsing, type-guards, and mathematical utilities to dedicated files inside the `src/helpers/` directory.
*   **Example:** `formatReplayTime()`, `isNetworkError()`, `getRequestType()`.

## 3. The "Rule of Two" for Reusable Components
**If a piece of UI (like a badge, an icon, a specific button layout, or an empty state) is used in more than two places, it must become a reusable component.**
*   **Action:** Extract these into `src/components/ui/` (e.g., `src/components/ui/EmptyState.tsx`, `src/components/ui/PriorityIcon.tsx`).
*   **Why?** Ensures consistent design and reduces code duplication.

## 4. Thin Page Components (Routes)
**Route files (`src/routes/**`) should contain minimal JSX.**
A route file's primary responsibility is to define the route, loader, and connect data to UI components.
*   **Action:** Do not write complex UI layouts directly inside the page component. Instead, create layout components in `src/components/` and import them into the page.
*   **Example:** Instead of writing a 300-line grid layout in `$id.issues.tsx`, create `<IssuesLayout issues={data} />` and import it.

## 5. Directory-based Routing
**Use folder structures for nested routes instead of flat-file naming.**
TanStack Router supports both flat files (`projects/$id.events.tsx`) and directories (`projects/$id/events.tsx`). We prefer directories for visual hierarchy.
*   **Good:** `src/routes/projects/$id/events.tsx`
*   **Bad:** `src/routes/projects/$id.events.tsx`

## 6. CSS Management
**Do not put all styles in a single `styles.css` file.**
*   Keep a `design-system.css` for CSS variables and global resets.
*   Keep a `layout.css` for global layout structures.
*   Create component-specific CSS files (e.g., `src/components/events/styles/network.css`) and import them.
