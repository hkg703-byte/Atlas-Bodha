"""Local acceptance run. Captures console links in memory, prints only assertions.
Starts/stops its own localhost:3220 dev server. Never sends real email.
"""
import asyncio, json, os, re, signal, subprocess, threading, time, urllib.request
from playwright.async_api import async_playwright

BASE = 'http://localhost:3220'
links = []
evidence = []
def record(message):
    evidence.append(message)
    print('PASS ' + message, flush=True)

def db(sql, values=None):
    code = """const {loadEnvConfig}=require('@next/env');loadEnvConfig(process.cwd());const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',async()=>{try{const a=JSON.parse(s);const r=await p.query(a.sql,a.values);console.log(JSON.stringify(r.rows));}catch{process.exitCode=1;}finally{await p.end();}});"""
    r = subprocess.run(['node','-e',code],input=json.dumps({'sql':sql,'values':values or []}),capture_output=True,text=True)
    if r.returncode: raise RuntimeError('Database test operation failed')
    return json.loads(r.stdout)

async def main():
    env = dict(os.environ, EMAIL_PROVIDER='console', APP_BASE_URL=BASE, SESSION_SECURE='false', DISPLAY=':0', TRUST_PROXY_IP='true')
    server = subprocess.Popen(['npm','run','dev','--','-H','127.0.0.1','-p','3220'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
    def consume():
        for line in server.stdout:
            match=re.search(r'http://localhost:3220/auth/verify\?token=[A-Za-z0-9_-]+',line)
            if match: links.append(match.group(0))
    threading.Thread(target=consume,daemon=True).start()
    try:
        for _ in range(120):
            try:
                with urllib.request.urlopen(BASE+'/sign-in',timeout=2): break
            except Exception: await asyncio.sleep(1)
        else: raise RuntimeError('Test server did not start')
        record('Test server and sign-in page load')
        baseline=db("SELECT user_id FROM external_identities WHERE provider='password' AND subject='josh-test@atlasbodha.local'")[0]['user_id']
        record('Existing test identity found')
        old=db('SELECT id FROM conversations WHERE user_id=$1 ORDER BY created_at LIMIT 1',[baseline])
        record('Conversation fixture rows: '+str(len(old)))
        assert old, 'Existing test account needs old conversation'
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=False,env=dict(os.environ,DISPLAY=':0'))
            context=await browser.new_context(viewport={'width':390,'height':664})
            page=await context.new_page()
            await page.goto(BASE+'/')
            assert page.url.split('?')[0]==BASE+'/sign-in'
            record('Unauthenticated home redirects to sign-in')
            assert (await context.request.get(BASE+'/api')).status==401
            assert (await context.request.get(BASE+'/api/v1/conversations')).status==401
            record('Unauthenticated API returns 401')
            record('Unauthenticated / redirects to /sign-in; /api and protected API return 401')
            assert await page.evaluate('document.documentElement.scrollHeight')==664
            record('Sign-in page fits viewport')
            record('/sign-in at 390x664: docScrollHeight == 664')
            stamp=str(time.time_ns())
            email='magic-'+stamp+'@atlasbodha.local'
            before=len(links)
            await page.get_by_label('Email',exact=True).fill(email)
            await page.get_by_label('First name (optional)').fill('Magic Test')
            await page.get_by_role('checkbox').check()
            await page.get_by_role('button',name='Send sign-in link').click()
            await page.get_by_text('Check your email for a sign-in link',exact=True).wait_for()
            assert len(links)==before+1
            link=links[-1]
            await page.goto(link)
            await page.wait_for_url(BASE+'/')
            await page.wait_for_function("document.activeElement?.id === 'atlas-message'")
            user=db("SELECT u.id,u.first_name,u.adult_attested_at IS NOT NULL AS adult FROM users u JOIN external_identities e ON u.id=e.user_id WHERE e.provider='email' AND e.subject=$1",[email])[0]
            assert user['first_name']=='Magic Test' and user['adult']
            record('New email: console link -> / signed in; composer autofocused; name and adult attestation stored')
            await page.get_by_role('textbox',name='Message Atlas').fill('Hello Atlas. Please share a short encouraging thought about learning something new.')
            await page.get_by_role('button',name='Send',exact=True).click()
            await page.wait_for_url('**/conversations/*')
            await page.wait_for_function("(document.querySelectorAll('article').length >= 2 && !document.querySelector('textarea').disabled) || document.querySelector('[role=alert]')",timeout=240000)
            if await page.locator('[role=alert]').count():
                text=await page.locator('[role=alert]').inner_text()
                for known in ['Atlas is resting', 'could not begin', 'already responding', 'reply limit', 'unavailable', 'try again', 'sign in']:
                    if known in text: print('Reply diagnostic: '+known,flush=True)
                raise RuntimeError('Reply failed')
            assert await page.locator('article').last.inner_text()
            record('New account sends message; actual assistant reply appears')
            await page.goto(link)
            await page.get_by_text('This link has already been used.',exact=True).wait_for()
            await page.get_by_role('link',name='Send a new link').wait_for()
            record('Same link reopened: link already used page')
            async def request(email,ip='192.0.2.10'):
                n=len(links)
                response=await context.request.post(BASE+'/api/auth/sign-in',data={'email':email,'adult':True},headers={'x-forwarded-for':ip})
                assert response.status==200
                assert (await response.json())['message']=='Check your email for a sign-in link'
                return links[-1] if len(links)>n else None
            expiredemail='expired-'+stamp+'@atlasbodha.local'
            expired=await request(expiredemail)
            assert expired
            db("UPDATE magic_link_tokens SET expires_at=NOW()-INTERVAL '1 minute' WHERE email=$1",[expiredemail])
            await page.goto(expired)
            await page.get_by_text('This link has expired.',exact=True).wait_for()
            record('Forced past expires_at: expired page with Send a new link')
            rateemail='rate-'+stamp+'@atlasbodha.local'
            for _ in range(3): assert await request(rateemail)
            assert await request(rateemail) is None
            assert db('SELECT count(*)::int AS count FROM magic_link_tokens WHERE email=$1',[rateemail])[0]['count']==3
            record('Email limit: fourth request generic 200, no email; DB token count = 3')
            existing=await request('josh-test@atlasbodha.local')
            assert existing
            await page.goto(existing)
            await page.wait_for_url(BASE+'/')
            assert db("SELECT user_id FROM external_identities WHERE provider='email' AND subject='josh-test@atlasbodha.local'")[0]['user_id']==baseline
            await page.goto(BASE+'/conversations/'+old[0]['id'])
            await page.locator('article').first.wait_for()
            record('Existing josh-test email identity has SAME original user id; old conversation visible')
            ip='192.0.2.20'
            for i in range(10): assert await request(f'ip-{stamp}-{i}@atlasbodha.local',ip)
            assert await request(f'ip-{stamp}-11@atlasbodha.local',ip) is None
            record('IP limit: eleventh email request suppressed across distinct emails')
            response=await context.request.post(BASE+'/api/auth/sign-in',data={'email':f'minor-{stamp}@atlasbodha.local','adult':False})
            assert response.status==200
            assert db('SELECT count(*)::int AS count FROM magic_link_tokens WHERE email=$1',[f'minor-{stamp}@atlasbodha.local'])[0]['count']==0
            record('Missing adult attestation creates no token')
            await browser.close()
    finally:
        os.killpg(server.pid,signal.SIGTERM)
        try: server.wait(timeout=15)
        except subprocess.TimeoutExpired: os.killpg(server.pid,signal.SIGKILL); server.wait()
        record('Owned localhost:3220 test server stopped')

if __name__=='__main__':
    try: asyncio.run(main())
    except Exception as error:
        # Playwright exceptions can embed request URLs/cookies. Never print them.
        print('FAIL acceptance check: '+type(error).__name__,flush=True)
        raise SystemExit(1)
