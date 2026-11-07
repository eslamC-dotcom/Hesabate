"""
هارنس اختبار بدون Firebase حقيقي: بيشغّل public/ على سيرفر محلي، ويستبدل مكتبات firebase
(من gstatic) بنسخ وهمية، ويحقن حركات تجريبية. الاستخدام:

    from tools.harness import run
    def scenario(pg):
        pg.click('.nav .tab[data-tab="sms"]')
        pg.fill('#smsText', 'نص رسالة')
        pg.click('[data-act="smsParse"]')
        print(pg.inner_text('#view'))
    run(scenario, tx=[{...}])

المتطلبات: pip install playwright ; playwright install chromium  (في بيئة Claude Code موجودين جاهزين).
الحركة التجريبية: {id,t(ms),type,amt,from,to,person,cat,note,...}  وأكواد الحسابات الافتراضية:
a_cash(جيبي) a_shop(الدكان) a_bank(البنك) a_voda(فودافون كاش) a_amz(أمازون) a_oth(حساب تاني)
"""
import subprocess, time, json, re, os
from playwright.sync_api import sync_playwright

APP = "export const initializeApp=()=>({});"
AUTH = ("export const getAuth=()=>({});export const onAuthStateChanged=(a,cb)=>{setTimeout(()=>cb({uid:'u1',email:'t@t'}),0);return()=>{}};"
        "export const GoogleAuthProvider=class{};export const signInWithPopup=()=>{};export const signInWithRedirect=()=>{};"
        "export const signInWithEmailAndPassword=()=>{};export const createUserWithEmailAndPassword=()=>{};"
        "export const signOut=()=>{};export const sendPasswordResetEmail=()=>{};")

def fs_stub(tx):
    return ("export const initializeFirestore=()=>({});export const persistentLocalCache=()=>({});export const persistentMultipleTabManager=()=>({});"
            "export const doc=(...a)=>({p:a.join('/')});export const collection=(...a)=>({c:a.join('/')});"
            "const R=%s;"
            "export const onSnapshot=(ref,cb)=>{setTimeout(()=>{if(ref.c){cb({docs:R.map(x=>({id:x.id,data:()=>x}))})}"
            "else cb({exists:()=>false,metadata:{fromCache:true},data:()=>null})},0);return()=>{}};"
            "export const setDoc=()=>Promise.resolve();export const writeBatch=()=>({set(){},delete(){},commit(){return Promise.resolve()}});") % json.dumps(tx)

def run(scenario, tx=(), public=None, port=8777, width=390, height=844, path='index.html', init=None):
    public = public or os.path.join(os.path.dirname(__file__), '..', 'public')
    srv = subprocess.Popen(['python3', '-m', 'http.server', str(port), '-d', public], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_context(viewport={'width': width, 'height': height}, service_workers='block', timezone_id='UTC', locale='ar-EG').new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            def route(r):
                u = r.request.url
                r.fulfill(body=APP if 'firebase-app' in u else AUTH if 'firebase-auth' in u else fs_stub(list(tx)), content_type='application/javascript')
            pg.route(re.compile(r'gstatic\.com/firebasejs'), route)
            if init: pg.add_init_script(init)
            pg.goto('http://localhost:%d/%s' % (port, path))
            pg.wait_for_timeout(900)
            scenario(pg)
            if errs: print('PAGE ERRORS:', errs)
            b.close()
    finally:
        srv.terminate()
