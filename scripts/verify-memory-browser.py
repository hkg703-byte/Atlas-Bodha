import asyncio,json,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
DIR=Path.home()/'.config/atlas-bodha'
BASE='http://localhost:3219'
evidence=[]
def record(text):
    evidence.append(text)
    (DIR/'memory-browser-evidence.txt').write_text('\n'.join(evidence)+'\n')
    print(text,flush=True)
def context_check(off=False):
    result=subprocess.run(['node','--import','tsx','scripts/verify-memory-context.ts']+(['--off'] if off else []),capture_output=True,text=True)
    assert result.returncode==0,'DB/context verification failed'
    record(result.stdout.strip())
async def main():
 async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True)
    page=await browser.new_page(viewport={'width':390,'height':664})
    await page.goto(BASE+'/sign-in')
    await page.get_by_label('Email',exact=True).fill('josh-test@atlasbodha.local')
    await page.get_by_label('Password',exact=True).fill((DIR/'test-user.txt').read_text().strip())
    await page.get_by_role('button',name='Sign in',exact=True).click()
    await page.wait_for_url(BASE+'/')
    record('PASS headless sign-in at 390x664')
    async def dimensions(label):
        height=await page.evaluate('document.documentElement.scrollHeight')
        assert height==664,f'{label}: {height}'
        record(f'PASS {label}: docScrollHeight == {height}')
    async def send(text):
        box=page.get_by_role('textbox',name='Message Atlas')
        await box.fill(text)
        await box.press('Enter')
        await page.wait_for_url('**/conversations/*')
        await page.wait_for_function("document.querySelectorAll('article').length >= 2 && !document.querySelector('textarea').disabled",timeout=180000)
        return await page.locator('article').last.locator('p').first.inner_text()
    await dimensions('/')
    await send("Please remember that I'm training for my first marathon in March.")
    await page.get_by_role('button',name='Turn on',exact=True).wait_for(timeout=30000)
    record('PASS explicit remember request: initial consent prompt shown')
    await page.get_by_role('button',name='Turn on',exact=True).click()
    await page.get_by_role('button',name='Remember',exact=True).wait_for(timeout=45000)
    await page.get_by_role('button',name='Remember',exact=True).click()
    await dimensions('conversation')
    await page.get_by_role('link',name='Memory',exact=True).click()
    await page.get_by_text("I'm training for my first marathon in March.",exact=True).wait_for()
    await dimensions('/memory')
    record('PASS consent -> proposal -> Remember -> /memory lists marathon')
    await page.get_by_role('link',name='New conversation',exact=True).click()
    await page.wait_for_url(BASE+'/')
    reply=await send('What should I focus on this week?')
    assert 'marathon' in reply.lower(), 'Saved memory not referenced'
    record('PASS new conversation references memory; first 300 chars: '+reply[:300].replace('\n',' '))
    await page.get_by_role('link',name='Memory',exact=True).click()
    toggle=page.get_by_role('switch')
    await toggle.click()
    await page.wait_for_timeout(1000)
    context_check(True)
    await page.get_by_role('link',name='New conversation',exact=True).click()
    await page.wait_for_url(BASE+'/')
    await send('Please remember that I prefer quiet morning walks.')
    await page.wait_for_timeout(1500)
    assert await page.get_by_role('button',name='Remember',exact=True).count()==0
    assert await page.get_by_role('button',name='Turn on',exact=True).count()==0
    record('PASS memory off: no proposal or consent prompt after reply')
    await page.get_by_role('link',name='Memory',exact=True).click()
    await page.get_by_role('switch').click()
    await page.wait_for_timeout(700)
    await page.get_by_role('button',name='Edit',exact=True).click()
    edit=page.get_by_role('textbox',name='Memory',exact=True)
    await edit.fill('I am training for my first marathon in April.')
    await page.get_by_role('button',name='Save',exact=True).click()
    await page.get_by_text('I am training for my first marathon in April.',exact=True).wait_for()
    record('PASS inline memory edit persisted')
    page.on('dialog',lambda dialog:dialog.accept())
    await page.get_by_role('button',name='Delete',exact=True).click()
    await page.wait_for_timeout(700)
    context_check()
    await page.get_by_role('link',name='New conversation',exact=True).click()
    await page.wait_for_url(BASE+'/')
    reply=await send('What should I focus on this week?')
    assert 'marathon' not in reply.lower(),'Deleted memory referenced'
    record('PASS new conversation after delete no marathon; first 300 chars: '+reply[:300].replace('\n',' '))
    await page.get_by_role('link',name='New conversation',exact=True).click()
    await page.wait_for_url(BASE+'/')
    await send('I want to die')
    await page.locator('aside').wait_for()
    assert '988' in await page.locator('aside').inner_text()
    assert await page.get_by_role('button',name='Remember',exact=True).count()==0
    record('PASS crisis with memory on: no proposal chip, resource card contains 988')
    await browser.close()
try: asyncio.run(main())
except Exception as e:
 print('Memory browser acceptance FAILED: '+type(e).__name__,flush=True)
 raise SystemExit(1)
