package eg.hesabaty.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * يفتح موقع دفتر حساباتي داخل WebView، ويوفّر للصفحة جسر AndroidBridge لقراءة
 * رسائل الجهات اللي المستخدم يختارها فقط. التحليل والمطابقة بيتموا في الصفحة.
 */
public class MainActivity extends Activity {
    static final String START_URL = "https://eslamc-dotcom.github.io/Hesabate/";
    static final int REQ_SMS = 7;

    WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.parseColor("#0F5C57"));

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " HesabatyApp/1");

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (isInternal(u)) return false;
                try {
                    String sc = u.getScheme();
                    Intent i = new Intent("tel".equals(sc) ? Intent.ACTION_DIAL : Intent.ACTION_VIEW, u);
                    startActivity(i);
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String html = "<html dir='rtl'><body style='font-family:sans-serif;padding:32px;text-align:center'>"
                            + "<h3>مفيش اتصال بالإنترنت</h3><p>اتأكد من النت وبعدين اضغط إعادة المحاولة.</p>"
                            + "<p><a href='" + START_URL + "'>إعادة المحاولة</a></p></body></html>";
                    view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
                }
            }
        });

        if (saved != null) {
            web.restoreState(saved);
        } else {
            web.loadUrl(START_URL);
        }
    }

    static boolean isInternal(Uri u) {
        String sc = u.getScheme();
        String h = u.getHost();
        if (!"https".equals(sc) || h == null) return false;
        return h.equals("eslamc-dotcom.github.io") || h.endsWith(".firebaseapp.com");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.onAppResume&&window.onAppResume()", null);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_SMS) {
            final boolean ok = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
            web.evaluateJavascript("window.onSmsPermission&&window.onSmsPermission(" + ok + ")", null);
        }
    }

    boolean hasSms() {
        return checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    class Bridge {
        @JavascriptInterface
        public boolean hasSmsPermission() {
            return hasSms();
        }

        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getPackageName()));
                startActivity(i);
            });
        }

        @JavascriptInterface
        public void requestSmsPermission() {
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.READ_SMS}, REQ_SMS));
        }

        /** الجهات اللي بعتت رسائل من وقت since (ملي ثانية)، مرتبة بالأكتر. */
        @JavascriptInterface
        public String listSenders(long since) {
            JSONArray out = new JSONArray();
            if (!hasSms()) return out.toString();
            Map<String, Integer> counts = new HashMap<>();
            try (Cursor c = getContentResolver().query(Uri.parse("content://sms/inbox"),
                    new String[]{"address"}, "date>?", new String[]{String.valueOf(since)}, "date DESC")) {
                if (c != null) {
                    while (c.moveToNext()) {
                        String a = c.getString(0);
                        if (a == null) continue;
                        Integer n = counts.get(a);
                        counts.put(a, n == null ? 1 : n + 1);
                    }
                }
            } catch (Exception ignored) {
            }
            List<Map.Entry<String, Integer>> list = new ArrayList<>(counts.entrySet());
            list.sort((x, y) -> y.getValue() - x.getValue());
            for (int i = 0; i < list.size() && i < 80; i++) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("address", list.get(i).getKey());
                    o.put("count", list.get(i).getValue());
                    out.put(o);
                } catch (Exception ignored) {
                }
            }
            return out.toString();
        }

        /** رسائل الجهات المحددة فقط، من since، الأقدم أولًا. */
        @JavascriptInterface
        public String readSms(long since, String sendersJson, int limit) {
            JSONArray out = new JSONArray();
            if (!hasSms()) return out.toString();
            Set<String> allow = new HashSet<>();
            try {
                JSONArray a = new JSONArray(sendersJson);
                for (int i = 0; i < a.length(); i++) allow.add(a.getString(i));
            } catch (Exception e) {
                return out.toString();
            }
            if (allow.isEmpty()) return out.toString();
            if (limit <= 0 || limit > 1000) limit = 500;
            try (Cursor c = getContentResolver().query(Uri.parse("content://sms/inbox"),
                    new String[]{"_id", "address", "body", "date"}, "date>?",
                    new String[]{String.valueOf(since)}, "date ASC")) {
                if (c != null) {
                    while (c.moveToNext() && out.length() < limit) {
                        String a = c.getString(1);
                        if (a == null || !allow.contains(a)) continue;
                        JSONObject o = new JSONObject();
                        o.put("id", c.getLong(0));
                        o.put("address", a);
                        o.put("body", c.getString(2));
                        o.put("date", c.getLong(3));
                        out.put(o);
                    }
                }
            } catch (Exception ignored) {
            }
            return out.toString();
        }

        @JavascriptInterface
        public void shareText(final String title, final String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, title);
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, title));
            });
        }
    }
}
