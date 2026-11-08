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

def S_tx_count(pg): return pg.query_selector_all('#view .row')

def chk(pg, label):
    t = pg.inner_text('body')
    for w in ('undefined', 'NaN', '[object', 'null'):
        if w in t: BAD.append('%s: ظهر "%s"' % (label, w))

def scenario(pg):
    chk(pg, 'home')
    for tab in ['log', 'people', 'sms', 'more', 'home']:
        pg.click('.nav .tab[data-tab="%s"]' % tab); pg.wait_for_timeout(200); chk(pg, tab)
    # التقارير والميزانية والفلاتر
    pg.click('[data-act="tab"][data-tab="rep"]'); pg.wait_for_timeout(250); chk(pg, 'rep')
    for sc_ in ['biz', 'per', 'all']:
        pg.click('[data-act="rScope"][data-id="%s"]' % sc_); pg.wait_for_timeout(150); chk(pg, 'rep ' + sc_)
    pg.click('[data-act="rOff"][data-d="-1"]'); pg.wait_for_timeout(150); chk(pg, 'rep prev'); pg.click('[data-act="rOff"][data-d="1"]')
    pg.click('[data-act="budgetEdit"] >> nth=0'); pg.wait_for_timeout(250); pg.fill('#bgAmt', '100'); pg.click('[data-act="bgSave"]'); pg.wait_for_timeout(200); chk(pg, 'budget')
    pg.click('.nav .tab[data-tab="log"]'); pg.click('[data-act="fRange"][data-id="m1"]'); pg.wait_for_timeout(150); chk(pg, 'log range')
    pg.click('[data-act="fRange"][data-id="all"]')
    pg.click('.nav .tab[data-tab="home"]'); pg.wait_for_timeout(200)
    # شاشة تسجيل حركة
    pg.click('[data-act="quick"][data-type="exp"]'); pg.wait_for_timeout(300); chk(pg, 'newTx'); pg.keyboard.press('Escape')
    # شخص + كشف حساب + رسالة واتساب
    pg.click('.nav .tab[data-tab="people"]'); pg.wait_for_timeout(200)
    pg.click('#view .row:has-text("أحمد")'); pg.wait_for_timeout(300); chk(pg, 'person')
    pg.click('[data-act="waOpen"]'); pg.wait_for_timeout(300); chk(pg, 'wa')
    if 'تفاصيل حسابنا' not in pg.input_value('#waMsg') or 'الباقي عليك: 300' not in pg.input_value('#waMsg'): BAD.append('wa: كشف الحساب غلط أو فاضي')
    if '➕' in pg.input_value('#waMsg'): BAD.append('wa: لسه فيه ➕')
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    # كشف حساب حد اتحوّله من فودافون كاش
    pg.click('#view .row:has-text("منى")'); pg.wait_for_timeout(300)
    pg.click('[data-act="waOpen"]'); pg.wait_for_timeout(300)
    m = pg.input_value('#waMsg')
    if 'تحويل فودافون كاش' not in m or 'سلف' in m: BAD.append('wa: سلف من فودافون كاش لازم تتكتب تحويل فودافون كاش')
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    # زر السداد السريع + ميعاد السداد
    pg.click('.nav .tab[data-tab="people"]'); pg.wait_for_timeout(200)
    pg.click('.prow .pay >> nth=0'); pg.wait_for_timeout(300); chk(pg, 'quick pay')
    if 'سداد' not in pg.inner_text('.sheet h3'): BAD.append('quick pay: شاشة السداد ما فتحتش')
    pg.keyboard.press('Escape')
    pg.click('#view .row:has-text("أحمد")'); pg.wait_for_timeout(250)
    pg.click('[data-act="personDue"]'); pg.wait_for_timeout(250); chk(pg, 'due sheet')
    pg.fill('#dueDate', '2026-10-30'); pg.click('[data-act="dueSave"]'); pg.wait_for_timeout(250)
    pg.click('.nav .tab[data-tab="home"]'); pg.wait_for_timeout(250); chk(pg, 'home due')
    if 'ديون ميعادها قرّب' not in pg.inner_text('#view') or 'متأخر' not in pg.inner_text('#view'): BAD.append('due: تنبيه الميعاد مظهرش في الرئيسية')
    # المظهر
    pg.click('.nav .tab[data-tab="more"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="theme"][data-m="dark"]'); pg.wait_for_timeout(150)
    if pg.evaluate("document.documentElement.dataset.theme")!='dark': BAD.append('theme: الداكن ما اشتغلش')
    pg.click('[data-act="theme"][data-m="auto"]'); pg.wait_for_timeout(150)
    if pg.evaluate("document.documentElement.dataset.theme")!=None: BAD.append('theme: التلقائي ما رجعش')
    # حركة متكررة: تتضاف، وتظهر مستحقة لما اليوم يعدّي، وتتسجّل
    pg.click('[data-act="recurNew"]'); pg.wait_for_timeout(250); chk(pg, 'recur sheet')
    pg.fill('#rcNote', 'إيجار تجريبي'); pg.fill('#rcAmt', '٧٠٠'); pg.fill('#rcDay', '10'); pg.click('[data-act="rcSave"]'); pg.wait_for_timeout(250)
    n0 = len(S_tx_count(pg))
    pg.evaluate("window.__now = window.__now + 9*86400000"); pg.click('.nav .tab[data-tab="home"]'); pg.wait_for_timeout(250); chk(pg, 'recur due')
    if 'حركات متكررة مستحقة' not in pg.inner_text('#view'): BAD.append('recur: مظهرتش مستحقة')
    pg.click('[data-act="recurDo"]'); pg.wait_for_timeout(250)
    if 'حركات متكررة مستحقة' in pg.inner_text('#view'): BAD.append('recur: لسه مستحقة بعد التسجيل')
    pg.click('.nav .tab[data-tab="log"]'); pg.wait_for_timeout(200)
    if 'إيجار تجريبي' not in pg.inner_text('#view'): BAD.append('recur: الحركة ما اتسجّلتش')
    pg.evaluate("window.__now = window.__now - 9*86400000")
    # قفل التطبيق
    pg.click('.nav .tab[data-tab="more"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="pinSetup"]'); pg.wait_for_timeout(200); pg.fill('#pin1', '1234'); pg.fill('#pin2', '1234'); pg.click('[data-act="pinSave"]'); pg.wait_for_timeout(400)
    pg.click('[data-act="lockNow"]'); pg.wait_for_timeout(200)
    if pg.locator('#lock').count()!=1: BAD.append('lock: القفل ما ظهرش')
    for k in '0000': pg.click('[data-act="lockKey"][data-k="%s"]' % k)
    pg.wait_for_timeout(400)
    if pg.locator('#lock').count()!=1 or 'غلط' not in pg.inner_text('#lockMsg'): BAD.append('lock: رقم غلط لازم يفضل مقفول')
    for k in '1234': pg.click('[data-act="lockKey"][data-k="%s"]' % k)
    pg.wait_for_timeout(400)
    if pg.locator('#lock').count()!=0: BAD.append('lock: الرقم الصح ما فتحش')
    pg.click('[data-act="pinOff"]'); pg.wait_for_timeout(200); pg.fill('#pinCur', '1234'); pg.click('[data-act="pinSave"]'); pg.wait_for_timeout(400)
    if pg.evaluate("localStorage.getItem('hs_pin')") is not None: BAD.append('lock: شيل القفل ما اشتغلش')
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
    run(scenario, tx=TX + [{'id':'t8','t':FIXED-86400000,'type':'lend','amt':250,'from':'a_voda','person':'منى'}], init=INIT)
    print('\n'.join(BAD) if BAD else 'OK: مفيش مشاكل ظاهرة')
    sys.exit(1 if BAD else 0)
