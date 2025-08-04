import { ArkInfo, RelativeTimelock, RestArkProvider, RestIndexerProvider } from '@arkade-os/sdk';
import { NotificationManager } from './notification-manager';

export class ServerManager {
    private provider: RestArkProvider | null = null;
    private serverUrl: string = '';
    private isConnected: boolean = false;
    private arkInfo: ArkInfo | null = null;
    
    constructor(private notificationManager: NotificationManager) {
        const savedUrl = this.getSavedServerUrl();
        if (savedUrl) {
            this.serverUrl = savedUrl;
        }
    }

    async connectToServer(url?: string): Promise<boolean> {
        const targetUrl = url || this.serverUrl;
        if (!targetUrl) {
            this.notificationManager.showError('Please enter a server URL');
            return false;
        }
        
        try {
            this.provider = new RestArkProvider(targetUrl);
            this.arkInfo = await this.provider.getInfo();
            
            this.serverUrl = targetUrl;
            this.isConnected = true;
            localStorage.setItem('arkServerUrl', targetUrl);
            this.notificationManager.showSuccess('Connected to Ark server successfully');
            return true;
        } catch (error) {
            this.notificationManager.showError('Failed to connect to server. Please check the URL and try again.');
            this.isConnected = false;
            return false;
        }
    }

    getUnilateralDelay(): RelativeTimelock {
        return {
            type: this.arkInfo!.unilateralExitDelay < 512 ? "blocks" : "seconds",
            value: this.arkInfo!.unilateralExitDelay,
        }
    }

    getServerKey(): string {
        return this.arkInfo!.signerPubkey.slice(2);
    }

    getProvider(): RestArkProvider | null {
        return this.provider;
    }
    getIndexerProvider():RestIndexerProvider{
        return new RestIndexerProvider(this.serverUrl);
    }

    getServerUrl(): string {
        return this.serverUrl;
    }

    setServerUrl(url: string): void {
        this.serverUrl = url;
    }

    isServerConnected(): boolean {
        return this.isConnected;
    }

    getSavedServerUrl(): string | null {
        return localStorage.getItem('arkServerUrl');
    }
    
    reset(): void {
        this.provider = null;
        this.isConnected = false;
        // Keep the server URL in case we want to reconnect
    }
    
    getNetworkInfo(): string {
        return this.arkInfo!.network;
    }
    
    getAddrPrefix():string{
    
        return this.getNetworkInfo() == 'mainnet' ? 'ark' : 'tark';
    }
}
