"""قسم الأمانات (ذهب وفضة وريال): إضافة، سعر النهارده، ربح/خسارة، مسح مع تراجع، وإنه مش داخل في الأرصدة."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..')); sys.path.insert(0, os.path.dirname(__file__))
from tools.harness import run
from test_golden import TX, INIT
BAD = []
SHOT = os.environ.get('SHOTS')
def sc(pg):
    pg.click('.nav .tab[data-tab="home"]'); pg.wait_for_timeout(200)
    home0 = pg.inner_html('#view')
    pg.click('.nav .tab[data-tab="more"]'); pg.wait_for_timeout(150)
    pg.click('[data-tab="vault"]'); pg.wait_for_timeout(200)
    def add(kind, q, own, cost, note=''):
        pg.click('[data-act="vtNew"]'); pg.wait_for_timeout(250)
        pg.click('[data-act="vtKind"][data-k="%s"]' % kind)
        pg.fill('#vtQ', q)
        if own: pg.fill('#vtOwn', own)
        if cost: pg.fill('#vtCost', cost)
        if note: pg.fill('#vtNote', note)
        pg.click('[data-act="vtSave"]'); pg.wait_for_timeout(300)
    add('g21', '50', 'أحمد', '150000', 'سبيكة')
    add('sil', '100', '', '')
    add('sar', '2000', 'أحمد', '')
    # السعر النهارده
    pg.click('[data-act="vtPrices"]'); pg.wait_for_timeout(250)
    pg.fill('#vp_g21', '4000'); pg.fill('#vp_sil', '60'); pg.fill('#vp_sar', '13.5')
    pg.click('[data-act="vtFetch"]'); pg.wait_for_timeout(1500)   # من غير نت: لازم يظهر تنبيه ومايبوظش
    msg = pg.inner_text('#vpMsg')
    if 'بإيدك' not in msg and 'اتملّت' not in msg: BAD.append('vault: رسالة جلب السعر مش ظاهرة: ' + msg)
    pg.fill('#vp_g21', '4000'); pg.fill('#vp_sil', '60'); pg.fill('#vp_sar', '13.5')
    pg.click('[data-act="vtPSave"]'); pg.wait_for_timeout(300)
    t = pg.inner_text('#view')
    if SHOT: pg.screenshot(path=SHOT + '/vault.png', full_page=True)
    for need in ['200,000', '+50,000', '27,000', '6,000', 'أحمد', 'ملكي']:
        if need not in t: BAD.append('vault: ناقص "%s" في الصفحة' % need)
    if 'undefined' in t or 'NaN' in t: BAD.append('vault: undefined/NaN')
    # تعديل ومسح مع تراجع
    pg.click('[data-act="vtEdit"]:has-text("فضة")'); pg.wait_for_timeout(250)
    pg.click('[data-act="vtDel"]'); pg.wait_for_timeout(300)
    if 'فضة · ' in pg.inner_text('#view'): BAD.append('vault: المسح ماشتغلش')
    pg.click('.toast [data-act], .toast button'); pg.wait_for_timeout(300)
    if 'فضة · ' not in pg.inner_text('#view'): BAD.append('vault: التراجع عن المسح ماشتغلش')
    # مش داخل في الرئيسية ولا الأرصدة
    pg.click('.nav .tab[data-tab="home"]'); pg.wait_for_timeout(250)
    if pg.inner_html('#view') != home0: BAD.append('vault: الرئيسية اتغيّرت بسبب الأمانات')
run(sc, tx=TX, init=INIT)
print('\n'.join(BAD) if BAD else 'OK: الأمانات تمام')
sys.exit(1 if BAD else 0)
