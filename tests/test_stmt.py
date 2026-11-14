"""شكل رسالة كشف الحساب: تجميع بالتاريخ، رصيد بعد كل حركة، البدء من آخر صفر، وآخر 10 حركات."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..')); sys.path.insert(0, os.path.dirname(__file__))
from tools.harness import run
BAD = []
def D(day, h=12):  # يوم من نوفمبر 2026
    import datetime
    return int(datetime.datetime(2026, 11, day, h, tzinfo=datetime.timezone.utc).timestamp() * 1000)
def tx(t, ty, amt, i): return {'id': 's%d' % i, 't': t, 'type': ty, 'amt': amt, 'person': 'زيد'}
OUT = {}
def sc(pg):
    def msg(rows, head=''):
        return pg.evaluate("([r,h])=>window.__hs.stmtMsg('زيد',h,r)", [rows, head])
    # 1) سيناريو المستخدم
    r = [tx(D(11), 'lend', 495, 1), tx(D(11, 13), 'lend', 4500, 2), tx(D(11, 14), 'lend', 3001, 3), tx(D(14), 'repay_in', 8000, 4), tx(D(14, 13), 'lend', 9001, 5)]
    OUT['user'] = msg(r)
    # 2) بعد آخر صفر
    OUT['zero'] = msg([tx(D(1), 'lend', 100, 1), tx(D(2), 'repay_in', 100, 2), tx(D(3), 'lend', 50, 3)])
    # 3) أكتر من 10 حركات من غير صفر
    OUT['long'] = msg([tx(D(1 + i), 'lend', 10, i) for i in range(14)])
    # 4) حساب خالص
    OUT['paid'] = msg([tx(D(1), 'lend', 100, 1), tx(D(2), 'repay_in', 100, 2)])
    # 5) مفيش حركات
    OUT['none'] = msg([])
pg_wait=1
run(sc, tx=[{'id':'z0','t':D(1),'type':'exp','amt':1,'from':'a_cash','cat':'أكل وشرب'}], path='index.html?__test=1')
u, z, l, p = OUT['user'], OUT['zero'], OUT['long'], OUT['paid']
for need in ['🧾 *حسابك عندنا*', '📅 11/11', '📅 14/11', '🔹 تجديد باقة'.replace('تجديد باقة', 'سلف'), '➕ سلف: 4,500 ج', '💰 الرصيد: 4,995 ج', '💰 الرصيد: 7,996 ج', '➖ سداد: 8,000 ج', '💰 الرصيد: -4 ج', '💰 الرصيد: 8,997 ج', '🔴 *الرصيد المتبقي: 8,997 جنيه*']:
    if need not in u: BAD.append('user: ناقص "%s"' % need)
if '▫️' in u: BAD.append('user: مفروض مفيش رصيد سابق')
if '100 ج' in z or '📅 01/11' in z or '📅 1/11' in z: BAD.append('zero: لسه بيعرض اللي قبل الصفر: ' + z)
if '💰 الرصيد: 50 ج' not in z: BAD.append('zero: الرصيد بعد الصفر غلط: ' + z)
if l.count('💰 الرصيد') != 10 or 'رصيد سابق: عليك 40 ج' not in l or 'الرصيد المتبقي: 140 جنيه' not in l: BAD.append('long: آخر 10 حركات غلط: ' + l)
if 'حسابنا خالص' not in p or p.count('💰 الرصيد') != 2: BAD.append('paid: الحساب الخالص غلط: ' + p)
if OUT['none'].count('لسه مفيش حركات') != 1: BAD.append('none: ' + OUT['none'])
if os.environ.get('SHOW'): print(u, '\n=====\n', z, '\n=====\n', l, '\n=====\n', p)
print('\n'.join(BAD) if BAD else 'OK: شكل الكشف تمام')
sys.exit(1 if BAD else 0)
