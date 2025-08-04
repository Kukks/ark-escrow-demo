import { CommunicationProvider } from './communication-provider';
import { LocalStorageCommunication } from './localstorage-communication';
import { NostrCommunication } from './nostr-communication';

/**
 * Communication provider configuration
 */
export interface CommunicationConfig {
    type: 'localStorage' | 'nostr';
    relayUrls?: string[]; // For Nostr provider
    privateKey?: string; // Private key for Nostr signing (same as Ark wallet)
}

/**
 * Manager for communication providers
 * Handles initialization and provides a single point of access
 */
export class CommunicationManager {
    private provider: CommunicationProvider | null = null;
    private config: CommunicationConfig;

    constructor(config?: CommunicationConfig) {
        // Default to localStorage, but allow Nostr configuration
        this.config = config || { type: 'localStorage' };
    }

    async initialize(): Promise<void> {
        if (this.provider) {
            await this.provider.cleanup();
        }

        // Create provider based on configuration
        switch (this.config.type) {
            case 'localStorage':
                this.provider = new LocalStorageCommunication();
                break;
            case 'nostr':
                this.provider = new NostrCommunication(this.config.relayUrls, this.config.privateKey);
                break;
            default:
                throw new Error(`Unknown communication provider type: ${this.config.type}`);
        }

        await this.provider.initialize();
        console.log(`Communication manager initialized with ${this.config.type} provider`);
    }

    getProvider(): CommunicationProvider {
        if (!this.provider) {
            throw new Error('Communication manager not initialized. Call initialize() first.');
        }
        return this.provider;
    }

    async cleanup(): Promise<void> {
        if (this.provider) {
            await this.provider.cleanup();
            this.provider = null;
        }
    }
}
