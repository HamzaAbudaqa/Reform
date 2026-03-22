import base64
import logging

logger = logging.getLogger(__name__)


async def take_screenshot_b64(url: str) -> str:
    """Take a screenshot of a URL and return base64-encoded PNG."""
    logger.info("Taking screenshot of %s", url)
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1500)
            screenshot = await page.screenshot(type="png", full_page=False)
            return base64.b64encode(screenshot).decode("utf-8")
        finally:
            await browser.close()


async def take_screenshot_with_css_b64(url: str, css_patch: str) -> str:
    """Load a URL, inject a CSS patch, and return a base64-encoded PNG screenshot."""
    logger.info("Taking CSS-patched screenshot of %s (%d chars CSS)", url, len(css_patch))
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1500)
            await page.add_style_tag(content=css_patch)
            await page.wait_for_timeout(500)
            screenshot = await page.screenshot(type="png", full_page=False)
            return base64.b64encode(screenshot).decode("utf-8")
        finally:
            await browser.close()
