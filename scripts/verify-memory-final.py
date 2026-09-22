import asyncio,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
DIR=Path.home()/'.config/atlas-bodha'
BASE='http://localhost:3219'
evidence=[]
def record(text):
 evidence.append(text);print(text,flush=True)
 (DIR/'memory-final-evidence.txt').write_text('\n'.join(evidence)+'\n')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  page=await browser.new_page(viewport={'width':390,'height':664})
  await page.goto(BASE+'/sign-in')
  await page.get_by_label('Email',exact=True).fill('josh-test@atlasbodha.local')
  await page.get_by_label('Password',exact=True).fill((DIR/'test-user.txt').read_text().strip())
  await page.get_by_role('button',name='Sign in',exact=True).click()
  await page.wait_for_url(BASE+'/')
  async def offer():
   box=page.get_by_role('textbox',name='Message Atlas')
   await box.fill("Please remember that I'm training for my first marathon in March.")
   await box.press('Enter')
   await page.wait_for_url('**/conversations/*')
   await page.get_by_role('button',name='Remember',exact=True).wait_for(timeout=180000)
  await offer()
  record('PASS final privacy-gated provider call still proposes explicit marathon fact')
  await page.get_by_role('button',name='No thanks',exact=True).click()
  await page.get_by_role('button',name='Remember',exact=True).wait_for(state='detached')
  await page.reload()
  await page.wait_for_timeout(1500)
  assert await page.get_by_role('button',name='Remember',exact=True).count()==0
  record('PASS No thanks: dismissed proposal stays absent after reload')
  await page.get_by_role('link',name='New conversation',exact=True).click()
  await page.wait_for_url(BASE+'/')
  await offer()
  await page.get_by_role('button',name='Remember',exact=True).click()
  await page.get_by_role('button',name='Remember',exact=True).wait_for(state='detached')
  await page.get_by_role('link',name='Memory',exact=True).click()
  await page.get_by_text("I'm training for my first marathon in March.",exact=True).wait_for()
  page.on('dialog',lambda dialog:dialog.accept())
  await page.get_by_role('button',name='Delete all memories',exact=True).click()
  await page.get_by_text('Nothing saved yet.',exact=False).wait_for()
  record('PASS Delete all memories: confirmed and list empty')
  assert await page.evaluate('document.documentElement.scrollHeight')==664
  record('PASS final /memory viewport remains 664')
  result=subprocess.run(['node','--import','tsx','scripts/verify-memory-context.ts'],capture_output=True,text=True)
  assert result.returncode==0
  record(result.stdout.strip())
  await browser.close()
try:asyncio.run(main())
except Exception as e:
 print('Final memory acceptance FAILED: '+type(e).__name__,flush=True)
 raise SystemExit(1)
