"""تغيير التاريخ وأنا بسجّل: أديته/تحويل، سداد سريع، تحويل فودافون من الرئيسية."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..')); sys.path.insert(0, os.path.dirname(__file__))
from tools.harness import run
from test_golden import TX, INIT
BAD = []
def close_all(pg):
    for _ in range(4):
        b = pg.query_selector('#sheetRoot [data-act="sheetClose"]')
        if not b: break
        b.click(); pg.wait_for_timeout(250)
SH = os.environ.get('SHOTS')
def sc(pg):
    pg.click('.nav .tab[data-tab="people"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="addPerson"]'); pg.wait_for_timeout(250)
    pg.fill('#apName', 'نور'); pg.fill('#apNum', '01099998888'); pg.click('[data-act="apSave"]'); pg.wait_for_timeout(400)
    # أديته: تاريخ قديم
    pg.click('[data-act="opStart"][data-k="lend_vcash"]'); pg.wait_for_timeout(300)
    pg.fill('#oAmt', '100'); pg.fill('#oNum', '01055556666'); pg.fill('#oDate', '2026-01-05'); pg.fill('#oNote', 'ثمن بضاعة'); pg.wait_for_timeout(200)
    if SH: pg.screenshot(path=SH + '/date_op.png', full_page=True)
    pg.click('[data-act="oSave"]'); pg.wait_for_timeout(400)
    m = pg.input_value('#waMsg')
    if '📝 ثمن بضاعة' not in m: BAD.append('op: الملاحظة مش ظاهرة في الرسالة: ' + m)
    if '📅 5/1' not in m: BAD.append('op: التاريخ القديم مش ظاهر في الكشف: ' + m)
    close_all(pg)
    # سداد سريع بتاريخ قديم
    pg.click('.nav .tab[data-tab="people"]'); pg.wait_for_timeout(250)
    pg.click('.prow:has-text("نور") .pay'); pg.wait_for_timeout(300)
    pg.fill('#payAmt', '40'); pg.fill('#payDate', '2026-01-07'); pg.click('[data-act="paySave"]'); pg.wait_for_timeout(500)
    m2 = pg.input_value('#waMsg')
    if '📅 5/1' not in m2 or '📅 7/1' not in m2 or 'الرصيد المتبقي: 60 جنيه' not in m2: BAD.append('pay: السداد بتاريخ قديم غلط: ' + m2)
run(sc, tx=TX, init=INIT)
print('\n'.join(BAD) if BAD else 'OK: تغيير التاريخ تمام')
sys.exit(1 if BAD else 0)
