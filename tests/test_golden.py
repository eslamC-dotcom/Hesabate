"""
اختبار "لقطة ذهبية": بيسجّل سلوك المحلل والواجهة الحالي ويقارنه بعد أي تعديل أو تنضيف.
  python3 tests/test_golden.py            # مقارنة (يفشل لو في فرق)
  python3 tests/test_golden.py --update   # تسجيل اللقطة الجديدة (بعد تغيير مقصود)
الوقت متجمّد على تاريخ ثابت عشان النتيجة ما تتغيرش من يوم ليوم.
"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
from tools.harness import run
from msgs import MSGS

FIXED = 1793600000000  # 2026-11-02 تقريبًا
INIT = ("(()=>{const R=Date,F=%d;class D extends R{constructor(...a){a.length?super(...a):super(F)}static now(){return F}};window.Date=D})()" % FIXED)
DAY = 86400000
TX = [
 {'id':'t1','t':FIXED-5*DAY,'type':'inc','amt':1200,'to':'a_shop','cat':'مبيعات','note':'إيراد'},
 {'id':'t2','t':FIXED-4*DAY,'type':'exp','amt':150,'from':'a_cash','cat':'أكل وشرب','note':'غدا'},
 {'id':'t3','t':FIXED-3*DAY,'type':'lend','amt':500,'from':'a_cash','person':'أحمد','op':'سلف كاش'},
 {'id':'t4','t':FIXED-2*DAY,'type':'repay_in','amt':200,'to':'a_cash','person':'أحمد'},
 {'id':'t5','t':FIXED-1*DAY,'type':'xfer','amt':300,'from':'a_shop','to':'a_voda'},
 {'id':'t6','t':FIXED-1*DAY,'type':'exp','amt':120,'from':'a_cash','cat':'طارئ','once':True,'note':'إصلاح'},
 {'id':'t7','t':FIXED-40*DAY,'type':'exp','amt':80,'from':'a_cash','cat':'مواصلات'},
]
OUT = {}

def scenario(pg):
    # 1) المحلل
    P = {}
    for k, v in MSGS.items():
        P[k] = pg.evaluate("""([m])=>{const H=window.__hs,a=H.parseMsg(m,null),b=H.parseMsg(m,1700000000000);
          const n=(p,f)=>{if(!p)return p;const q=Object.assign({},p);if(!f&&!q.hasDate)delete q.t;return q};
          return {free:n(a,false),fixed:n(b,true),split:H.splitMsgs(m).length,guess:a?H.guessAcc(a.m):null}}""", [v])
    OUT['parse'] = P
    # 2) الواجهة
    V = {}
    for tab in ['home', 'log', 'people', 'sms', 'more']:
        pg.click('.nav .tab[data-tab="%s"]' % tab); pg.wait_for_timeout(200)
        V[tab] = pg.inner_html('#view')
    pg.click('.nav .tab[data-tab="sms"]')
    pg.fill('#smsText', "\n\n".join([MSGS['vf_out'], MSGS['vf_in'], MSGS['vf_elec'], MSGS['cib_dr'], MSGS['cib_in']]))
    pg.click('[data-act="smsParse"]'); pg.wait_for_timeout(400)
    V['sms_parsed'] = pg.inner_html('#view')
    pg.click('.nav .tab[data-tab="log"]'); pg.wait_for_timeout(200)
    for tid in ['t2', 't3', 't5']:
        pg.evaluate("(id)=>{const el=document.querySelector('[data-act=openTx][data-id=\"'+id+'\"]');if(el)el.click()}", tid)
        pg.wait_for_timeout(250)
        V['sheet_' + tid] = pg.evaluate("()=>{const s=document.querySelector('.sheet');return s?s.innerHTML:null}")
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    OUT['views'] = V

if __name__ == '__main__':
    run(scenario, tx=TX, path='index.html?__test=1', init=INIT)
    f = os.path.join(HERE, 'golden.json')
    new = json.dumps(OUT, ensure_ascii=False, indent=1, sort_keys=True)
    if '--update' in sys.argv or not os.path.exists(f):
        open(f, 'w', encoding='utf-8').write(new); print('اتسجّلت اللقطة:', f); sys.exit(0)
    old = open(f, encoding='utf-8').read()
    if old == new: print('OK: مفيش فرق عن اللقطة الذهبية'); sys.exit(0)
    import difflib
    d = list(difflib.unified_diff(old.splitlines(), new.splitlines(), 'قبل', 'بعد', lineterm='', n=0))
    print('فرق عن اللقطة الذهبية (%d سطر):' % len(d)); print('\n'.join(d[:60])); sys.exit(1)
