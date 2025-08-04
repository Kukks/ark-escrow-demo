import { ArkEscrowApp } from './app';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const app = new ArkEscrowApp();

    // Expose app globally for contract action buttons
    (window as any).arkApp = app;

    await app.initialize();
});
