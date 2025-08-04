export class NotificationManager {
    private notificationContainer: HTMLElement | null = null;

    constructor() {
        this.initializeContainer();
    }

    private initializeContainer(): void {
        this.notificationContainer = document.getElementById('notifications');
        if (!this.notificationContainer) {
            // Create notification container if it doesn't exist
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.id = 'notifications';
            this.notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                max-width: 300px;
            `;
            document.body.appendChild(this.notificationContainer);
        }
    }

    showSuccess(message: string): void {
        this.showNotification(message, 'success');
    }

    showError(message: string): void {
        this.showNotification(message, 'error');
    }

    showInfo(message: string): void {
        this.showNotification(message, 'info');
    }

    showWarning(message: string): void {
        this.showNotification(message, 'warning');
    }

    private showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
        if (!this.notificationContainer) return;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            ${this.getTypeStyles(type)}
        `;

        this.notificationContainer.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove after 5 seconds
        setTimeout(() => {
            this.removeNotification(notification);
        }, 5000);

        // Add click to dismiss
        notification.addEventListener('click', () => {
            this.removeNotification(notification);
        });
    }

    private getTypeStyles(type: string): string {
        switch (type) {
            case 'success':
                return 'background-color: #4CAF50;';
            case 'error':
                return 'background-color: #f44336;';
            case 'warning':
                return 'background-color: #ff9800;';
            case 'info':
            default:
                return 'background-color: #2196F3;';
        }
    }

    private removeNotification(notification: HTMLElement): void {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    updateStatus(message: string): void {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    clearNotifications(): void {
        if (this.notificationContainer) {
            this.notificationContainer.innerHTML = '';
        }
    }
}
