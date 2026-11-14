"""رسايل فودافون كاش: التحويل المسجّل من جوه البرنامج بيتطابق حتى لو الرقم اللي كتبته غير الرقم الفعلي، والمستلم بيتسجّل سداد من شخص."""
import sys, os, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..')); sys.path.insert(0, os.path.dirname(__file__))
from tools.harness import run
ts = lambda s: int(datetime.datetime.fromisoformat(s).replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)
TXS = [{'id': 'x1', 't': ts('2026-11-14T17:36:00'), 'type': 'lend', 'amt': 9000, 'from': 'a_voda', 'person': 'سعيد', 'op': 'lend_vcash', 'note': 'تحويل فودافون كاش', 'num': '01099998888'}]
SMS = """تم تحويل 9000 جنيه لرقم 01000268322 مصاريف الخدمة 0 جنيه رصيد حسابك فى فودافون كاش الحالي 42632.02.
تاريخ العملية 17:39 26-11-14 :
رقم العملية 025781149650 :
 حول فلوس لأي محفظة وزود فرصك تكسب جنيه دهب! وكمان هيجيلك لحد 100ج كاش باك. http://vf.eg/vfcash?id=money_transfer
تم استلام مبلغ 8000 جنيه من رقم 01080372360 المسجل بإسم Hamouda S Attia على رقم محفظتك  01021139398.
رصيدك الحالي: 51632.02 جنيه
تاريخ العملية: 17:38 26-11-14
رقم العملية: 025781106782
تابع كل مصروفاتك من تاريخ المعاملات على أبلكيشن أنا فودافون http://vf.eg/vfcash"""
BAD = []
def sc(pg):
    pg.click('.nav .tab[data-tab="sms"]'); pg.wait_for_timeout(200)
    pg.fill('#smsText', SMS); pg.click('[data-act="smsParse"]'); pg.wait_for_timeout(500)
    t = pg.inner_text('#view')
    if '1 رسالة اتطابقت' not in t: BAD.append('sms: التحويل 9000 ماتطابقش مع المسجّل (الرقم مختلف)')
    if t.count('9,000 ج.م') > 1 and 'راجع قبل ما تضيف' in t and '9,000 ج.م\nخارج' in t: BAD.append('sms: 9000 ظهر كحركة جديدة')
    pg.click('button:has-text("سدّد لي شخص")'); pg.wait_for_timeout(300)
    pg.click('[data-act="smsPersonPick"]:has-text("سعيد")'); pg.wait_for_timeout(200)
    pg.click('[data-act="smsAdd"]'); pg.wait_for_timeout(500)
    pg.click('.nav .tab[data-tab="people"]'); pg.wait_for_timeout(250)
    pp = pg.inner_text('#view')
    if '1,000' not in pp: BAD.append('sms: سداد الـ 8000 ماتسجّلش على سعيد (المتوقع باقي 1000): ' + pp[:300])
run(sc, tx=TXS, path='index.html?__test=1')
print('\n'.join(BAD) if BAD else 'OK: مطابقة الرسايل تمام')
sys.exit(1 if BAD else 0)
