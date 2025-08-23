export function oauthCallbackSuccessHtml(): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Redirecting</title>
        <style>
          :root { color-scheme: light dark; }
          html, body { height: 100%; margin: 0; }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
            background: Canvas;
            color: CanvasText;
          }
          .card {
            padding: 24px 28px;
            border-radius: 12px;
            background: Color(srgb 1 1 1 / 0.7);
            backdrop-filter: blur(6px);
            box-shadow: 0 6px 24px rgba(0,0,0,0.15);
            border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
            min-width: 220px;
          }
          @media (prefers-color-scheme: dark) {
            .card { background: Color(srgb 0.12 0.12 0.12 / 0.6); }
          }
          .title { font-size: 16px; font-weight: 600; margin: 0; letter-spacing: 0.1px; }
          .note { margin: 6px 0 0; opacity: 0.75; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <p class="title">Redirecting…</p>
          <p class="note">You can close this window.</p>
        </div>
        <script>
          (function() {
            function tryCloseOnce() {
              try { window.close(); } catch (e) {}
              try { window.opener && window.opener.postMessage && window.opener.postMessage({ type: 'oauth-close' }, '*'); } catch (e) {}
              try { window.open('', '_self'); } catch (e) {}
              try { window.close(); } catch (e) {}
            }

            setTimeout(tryCloseOnce, 200);
            setTimeout(tryCloseOnce, 600);
            setTimeout(tryCloseOnce, 1200);
          })();
        </script>
      </body>
    </html>
  `;
}

export function oauthCallbackErrorHtml(): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Authorization canceled</title>
        <style>
          :root { color-scheme: light dark; }
          html, body { height: 100%; margin: 0; }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
            background: Canvas;
            color: CanvasText;
          }
          .card {
            padding: 24px 28px;
            border-radius: 12px;
            background: Color(srgb 1 1 1 / 0.7);
            backdrop-filter: blur(6px);
            box-shadow: 0 6px 24px rgba(0,0,0,0.15);
            border: 1px solid color-mix(in oklab, CanvasText 12%, transparent);
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 240px;
          }
          @media (prefers-color-scheme: dark) {
            .card { background: Color(srgb 0.12 0.12 0.12 / 0.6); }
          }
          .title { font-size: 16px; font-weight: 600; margin: 0; letter-spacing: 0.1px; }
        </style>
      </head>
      <body>
        <div class="card">
          <p class="title">Authorization canceled.</p>
        </div>
        <script>
          (function() {
            function tryCloseOnce() {
              try { window.close(); } catch (e) {}
              try { window.opener && window.opener.postMessage && window.opener.postMessage({ type: 'oauth-close' }, '*'); } catch (e) {}
              try { window.open('', '_self'); } catch (e) {}
              try { window.close(); } catch (e) {}
            }

            setTimeout(tryCloseOnce, 200);
            setTimeout(tryCloseOnce, 600);
            setTimeout(tryCloseOnce, 1200);
          })();
        </script>
      </body>
    </html>
  `;
}
