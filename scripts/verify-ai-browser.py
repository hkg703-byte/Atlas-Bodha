import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
DIR=Path.home()/'.config/atlas-bodha'
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        page=await browser.new_page(viewport={'width':390,'height':664})
        await page.goto('http://localhost:3217/sign-in')
        await page.get_by_label('Email').fill('josh-test@atlasbodha.local')
        await page.get_by_label('Password').fill((DIR/'test-user.txt').read_text().strip())
        await page.get_by_role('button',name='Sign in').click()
        await page.wait_for_url('http://localhost:3217/')
        textarea=page.get_by_role('textbox',name='Message Atlas')
        await textarea.fill('I am deciding whether to change careers and want a small first step.')
        await textarea.press('Shift+Enter')
        assert '\n' in await textarea.input_value()
        await textarea.press('Enter')
        await page.wait_for_url('**/conversations/*')
        await page.wait_for_function("document.querySelectorAll('article').length >= 2",timeout=180000)
        await page.wait_for_function("!document.body.innerText.includes('Responding…') && !document.querySelector('textarea').disabled",timeout=180000)
        await page.reload()
        await page.wait_for_selector('article:nth-child(2)')
        assert await page.locator('article').count()==2
        dimensions=await page.evaluate('({height:innerHeight, scrollHeight:document.documentElement.scrollHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
        assert dimensions['height']==dimensions['scrollHeight']==664,dimensions
        assert dimensions['width']==dimensions['scrollWidth']==390,dimensions
        assert await page.get_by_text('Atlas is an AI, not a person or a therapist.',exact=True).is_visible()
        box=await page.locator('textarea').bounding_box()
        assert box and box['y']+box['height']<=664
        await page.screenshot(path=str(DIR/'atlas-e2e.png'))
        evidence=['Playwright headless: sign-in -> home -> Shift+Enter newline -> Enter -> conversation -> real reply -> reload PASS',f'Canonical article count after reload: {await page.locator("article").count()}',f'Viewport: {json.dumps(dimensions)}',f'Composer bottom within viewport: {box["y"]+box["height"]:.1f}',f'Screenshot: {DIR}/atlas-e2e.png']
        conversations=json.loads((DIR/'ai-test-conversations.json').read_text())
        await page.goto('http://localhost:3217/conversations/'+conversations['crisis'])
        await page.wait_for_selector('aside')
        assert '988' in await page.locator('aside').inner_text()
        assert await page.locator('article').last.evaluate("e=>e.firstElementChild.tagName === 'ASIDE'")
        evidence.append('Tier3 UI: resource card first in persisted assistant article PASS')
        await page.goto('http://localhost:3217/conversations/'+conversations['historic'])
        assert await page.locator('aside').count()==0
        evidence.append('Historical UI: no resource card PASS')
        (DIR/'ai-browser-evidence.txt').write_text('\n'.join(evidence)+'\n')
        print('\n'.join(evidence))
        await browser.close()
try:asyncio.run(main())
except Exception as e:
    print('Browser acceptance failed:',type(e).__name__)
    raise SystemExit(1)
