package com.alberto.perfumario;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

// Abre tu perfil de Fragrantica en una ventana de la app y le inyecta el script que lee el armario
// (collectWardrobe en src/lib/fragranticaWardrobe.js). Se ve la página mientras carga, por si
// Fragrantica pide alguna comprobación.
@CapacitorPlugin(name = "FragranticaWardrobe")
public class FragranticaWardrobePlugin extends Plugin {
    private static final long TIMEOUT_MS = 90000;

    // java.util.function.Consumer pide Android 7 y la app funciona desde el 6
    private interface Finish {
        void accept(Runnable result);
    }

    @PluginMethod
    public void read(PluginCall call) {
        String url = call.getString("url");
        String script = call.getString("script");
        if (url == null || script == null || !isFragrantica(Uri.parse(url))) {
            call.reject("Ese enlace no es de Fragrantica.");
            return;
        }
        getActivity().runOnUiThread(() -> open(call, url, script));
    }

    private static boolean isFragrantica(Uri uri) {
        String host = uri.getHost();
        return host != null && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
            && host.matches("(?:[\\w-]+\\.)*fragrantica\\.[a-z.]+");
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void open(PluginCall call, String url, String script) {
        Activity activity = getActivity();
        Handler main = new Handler(Looper.getMainLooper());
        Dialog dialog = new Dialog(activity, android.R.style.Theme_DeviceDefault_NoActionBar);
        WebView web = new WebView(activity);
        boolean[] finished = {false};

        // Acaba una sola vez: con los perfumes, con un error o al cancelar
        Finish finish = (result) -> main.post(() -> {
            if (finished[0]) return;
            finished[0] = true;
            result.run();
            dialog.dismiss();
        });

        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void done(String json) {
                finish.accept(() -> {
                    try {
                        JSObject res = new JSObject();
                        res.put("items", new JSArray(json));
                        call.resolve(res);
                    } catch (JSONException e) {
                        call.reject("No he podido leer el armario.");
                    }
                });
            }

            @JavascriptInterface
            public void fail(String message) {
                finish.accept(() -> call.reject(message));
            }
        }, "PerfumarioWardrobe");
        web.setWebViewClient(new WebViewClient() {
            // Solo Fragrantica: no se sale de su web aunque se toque un enlace
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isFragrantica(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String loaded) {
                view.evaluateJavascript(script, null);
            }
        });

        TextView title = new TextView(activity);
        title.setText("Leyendo tu armario de Fragrantica…");
        title.setTextColor(Color.WHITE);
        title.setTextSize(15);
        Button cancel = new Button(activity);
        cancel.setText("Cancelar");
        cancel.setOnClickListener((v) -> finish.accept(() -> call.reject("Cancelado")));
        LinearLayout bar = new LinearLayout(activity);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(Color.parseColor("#120e0c"));
        bar.setPadding(32, 16, 16, 16);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        bar.addView(cancel);

        LinearLayout root = new LinearLayout(activity);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setFitsSystemWindows(true);
        root.setBackgroundColor(Color.parseColor("#120e0c"));
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        dialog.setContentView(root);
        dialog.setOnCancelListener((d) -> finish.accept(() -> call.reject("Cancelado"))); // botón atrás
        dialog.setOnDismissListener((d) -> web.destroy());
        dialog.show();
        web.loadUrl(url);
        main.postDelayed(() -> finish.accept(() -> call.reject("Fragrantica ha tardado demasiado. Inténtalo otra vez.")), TIMEOUT_MS);
    }
}
