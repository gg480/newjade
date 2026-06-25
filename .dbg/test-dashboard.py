"""Module 1: Dashboard UI test — login, navigate, verify cards/charts/filters"""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5000"
SCREENSHOT_DIR = ".dbg/screenshots"

import os
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []
console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Capture console errors
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)

    # Step 1: Login
    print("1. Logging in...")
    page.goto(f"{BASE}/api/auth/login", wait_until="networkidle")
    # Navigate to main page and use the login form
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(2000)

    # Check if login page is shown
    if page.locator('input[name="username"]').count() > 0 or page.locator('input[type="text"]').count() > 0:
        print("   Login page detected, filling credentials...")
        # Fill username
        inputs = page.locator('input').all()
        if len(inputs) >= 2:
            inputs[0].fill("admin")
            inputs[1].fill("admin123")
        # Click login button
        page.locator('button[type="submit"]').first.click()
        page.wait_for_timeout(3000)
        page.wait_for_load_state("networkidle")

    # Step 2: Navigate to Dashboard tab
    print("2. Navigating to Dashboard...")
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(3000)

    # Take initial screenshot
    page.screenshot(path=f"{SCREENSHOT_DIR}/module-1-dashboard-full.png", full_page=True)
    print("   Screenshot saved: module-1-dashboard-full.png")

    # Step 3: Check for core metric cards using data-testid
    print("3. Checking metric cards...")
    test_ids = [
        "dashboard-card-total-items",
        "dashboard-card-total-value",
        "dashboard-card-total-sales",
        "dashboard-card-total-profit",
        "dashboard-card-total-customers",
        "dashboard-card-total-batches",
    ]
    for tid in test_ids:
        el = page.locator(f'[data-testid="{tid}"]')
        count = el.count()
        visible = el.first.is_visible() if count > 0 else False
        status = "✅" if count > 0 and visible else "❌"
        results.append(f"  {status} {tid}: found={count}, visible={visible}")
        print(results[-1])

    # Also check for generic card elements
    cards = page.locator('.card, [class*="Card"], [class*="metric"]').count()
    print(f"   Generic card-like elements found: {cards}")

    # Step 4: Check for chart/recharts elements
    print("4. Checking charts...")
    chart_elems = page.locator('.recharts-wrapper, svg.recharts-surface, [class*="chart"], [class*="Chart"]')
    chart_count = chart_elems.count()
    results.append(f"  {'✅' if chart_count > 0 else '❌'} Chart elements: {chart_count}")
    print(results[-1])

    # Step 5: Check time filter
    print("5. Checking time filters...")
    # Look for time-related buttons/dropdowns
    filter_elems = page.locator('button:has-text("月"), button:has-text("季"), button:has-text("年"), button:has-text("全部")')
    filter_count = filter_elems.count()
    results.append(f"  {'✅' if filter_count > 0 else '❌'} Time filter buttons: {filter_count}")
    print(results[-1])

    # Try clicking filter buttons
    for btn in filter_elems.all():
        try:
            txt = btn.inner_text()
            btn.click()
            page.wait_for_timeout(1500)
            print(f"   Clicked filter: {txt} - page stable")
        except Exception as e:
            print(f"   Filter click error: {e}")

    # Step 6: Check for material filter
    material_select = page.locator('select, [class*="Select"], [role="combobox"]').count()
    results.append(f"  🔍 Select/combobox elements: {material_select}")
    print(results[-1])

    # Final screenshot after interactions
    page.screenshot(path=f"{SCREENSHOT_DIR}/module-1-dashboard-after-interact.png", full_page=True)

    # Summary
    red_errors = [e for e in console_errors if "error" in e.lower() or "fail" in e.lower()]
    print(f"\n6. Console errors (red): {len(red_errors)}")
    for e in red_errors[:10]:
        print(f"   {e[:150]}")

    browser.close()

# Print report
print("\n" + "="*60)
print("📊 Module 1: Dashboard — Test Summary")
print("="*60)
for r in results:
    print(r)
print(f"\nConsole errors: {len(red_errors)}")
print(f"Screenshots: {SCREENSHOT_DIR}/module-1-dashboard-*.png")
