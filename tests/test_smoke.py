"""
اختبار دخان: بيفتح كل التبويبات والشاشات الأساسية ويتأكد من:
 - مفيش أخطاء جافاسكربت في الصفحة
 - مفيش "undefined" أو "NaN" ظاهرة في النص
  python3 tests/test_smoke.py
"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
from tools.harness import run
from test_golden import TX, INIT, FIXED
from msgs import MSGS
BAD = []

def chk(pg, label):
    t = pg.inner_text('body')
    for w in ('undefined', 'NaN', '[object', 'null'):
        if w in t: BAD.append('%s: ظهر "%s"' % (label, w))

def scenario(pg):
    chk(pg, 'home')
    for tab in ['log', 'people', 'sms', 'more', 'home']:
        pg.click('.nav .tab[data-tab="%s"]' % tab); pg.wait_for_timeout(200); chk(pg, tab)
    # شاشة تسجيل حركة
    pg.click('[data-act="quick"][data-type="exp"]'); pg.wait_for_timeout(300); chk(pg, 'newTx'); pg.keyboard.press('Escape')
    # شخص + كشف حساب + رسالة واتساب
    pg.click('.nav .tab[data-tab="people"]'); pg.wait_for_timeout(200)
    pg.click('#view .row >> nth=0'); pg.wait_for_timeout(300); chk(pg, 'person')
    pg.click('[data-act="waOpen"]'); pg.wait_for_timeout(300); chk(pg, 'wa')
    if 'تفاصيل حسابنا' not in pg.input_value('#waMsg') or 'الباقي عليك: 300' not in pg.input_value('#waMsg'): BAD.append('wa: كشف الحساب غلط أو فاضي')
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    # حساب
    pg.click('.nav .tab[data-tab="more"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="openAcc"] >> nth=0'); pg.wait_for_timeout(300); chk(pg, 'acc'); pg.keyboard.press('Escape')
    # تحويل فودافون
    pg.click('.nav .tab[data-tab="home"]'); pg.click('[data-act="vcOpen"]'); pg.wait_for_timeout(300); chk(pg, 'vc'); pg.keyboard.press('Escape')
    # رسايل
    pg.click('.nav .tab[data-tab="sms"]')
    pg.fill('#smsText', "\n\n".join(MSGS[k] for k in ['vf_out', 'vf_in', 'vf_elec', 'cib_dr', 'cib_cc', 'cib_in']))
    pg.click('[data-act="smsParse"]'); pg.wait_for_timeout(400); chk(pg, 'sms parsed')
    pg.click('[data-act="smsAdd"]'); pg.wait_for_timeout(400); chk(pg, 'sms added')
    pg.click('.nav .tab[data-tab="log"]'); pg.wait_for_timeout(200); chk(pg, 'log after sms')

if __name__ == '__main__':
    run(scenario, tx=TX, init=INIT)
    print('\n'.join(BAD) if BAD else 'OK: مفيش مشاكل ظاهرة')
    sys.exit(1 if BAD else 0)
