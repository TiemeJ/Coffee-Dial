import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/playwright',
    timeout: 60_000,
    expect: {
        timeout: 15_000
    },
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure'
    },
    webServer: {
        // Larger listen backlog: the default (5) resets connections when the app bursts ~170 module requests.
        command: 'python3 -c "import http.server as h; h.ThreadingHTTPServer.request_queue_size = 512; h.test(HandlerClass=h.SimpleHTTPRequestHandler, ServerClass=h.ThreadingHTTPServer, port=4173, bind=\'127.0.0.1\')"',
        url: 'http://127.0.0.1:4173/index.html',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
    }
});
