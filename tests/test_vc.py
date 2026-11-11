"""تحويل فودافون كاش لرقم تاني: الرسالة تروح لرقم الشخص، والرسوم تتضاف على حسابه."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..')); sys.path.insert(0, os.path.dirname(__file__))
from tools.harness import run
from test_golden import TX, INIT
BAD = []
def sc(pg):
    pg.click('.nav .tab[data-tab="people"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="addPerson"]'); pg.wait_for_timeout(250)
    pg.fill('#apName', 'كريم'); pg.fill('#apNum', '01099998888'); pg.click('[data-act="apSave"]'); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    pg.click('.nav .tab[data-tab="home"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="vcOpen"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="vPerson"]:has-text("كريم")'); pg.click('[data-act="vPurp"][data-v="lend"]')
    pg.fill('#vNum', '01055556666'); pg.fill('#vAmt', '1000'); pg.fill('#vFee', '10')
    pg.click('[data-act="vGen"]'); pg.wait_for_timeout(300); pg.click('[data-act="vDone"]'); pg.wait_for_timeout(400)
    if pg.input_value('#waNum') != '01099998888': BAD.append('vc: الرسالة مش رايحة لرقم الشخص: ' + pg.input_value('#waNum'))
    m = pg.input_value('#waMsg')
    if 'تحويل فودافون كاش: *1,010 ج*' not in m or 'الإجمالي عليك: 1,010' not in m: BAD.append('vc: الرسوم مش متضافة على المبلغ: ' + m)
    if m.count('تحويل فودافون كاش') != 1: BAD.append('vc: سطر الرسوم ظاهر لوحده')
run(sc, tx=TX, init=INIT)
print('\n'.join(BAD) if BAD else 'OK: تحويل فودافون كاش تمام')
sys.exit(1 if BAD else 0)
