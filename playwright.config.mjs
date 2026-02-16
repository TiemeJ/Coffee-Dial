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
        command: 'python3 -m http.server 4173',
        url: 'http://127.0.0.1:4173/index.html',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
    }
});
