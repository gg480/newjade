Task ID: 12
Agent: main-agent
Task: UI Enhancements — Smart Spec Fields, Profit/Loss Coding, Progress Bars, Row Hover, Quick Dates

Work Log:
- Read all 5 target files before making any edits
- Task 1: Enhanced renderSpecFields() in item-create-dialog.tsx with smart input types
- Task 2: Added profit/loss color coding + arrow indicators in sales-tab.tsx (desktop + mobile)
- Task 3: Replaced batch entry progress text with visual progress bars in batches-tab.tsx
- Task 4: Added status-based left border hover on inventory table rows in inventory-tab.tsx
- Task 5: Added quick date range buttons (近7天/近30天/近90天) in dashboard-tab.tsx
- Removed unused variable `profitPct` to keep lint clean
- bun run lint → 0 errors, 0 warnings
- Updated worklog.md

Stage Summary:
- All 5 tasks completed successfully
- Lint passes with 0 errors
- All changes are minimal and surgical, only modifying what's needed
