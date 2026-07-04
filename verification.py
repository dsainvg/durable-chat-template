from playwright.sync_api import sync_playwright
import re

def run_cuj(page):
    page.goto("http://localhost:8787")
    page.wait_for_timeout(1000)

    page.evaluate("localStorage.removeItem('syncduo_token');")
    page.goto("http://localhost:8787")
    page.wait_for_timeout(2000)

    # Delay the response to keep the loading state visible
    page.route("**/api/user/**", lambda route: page.wait_for_timeout(2000) or route.continue_())

    # Click the first profile
    page.get_by_text("Sai").click()
    page.wait_for_timeout(500)

    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(2000)

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
