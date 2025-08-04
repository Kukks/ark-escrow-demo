import NDK, { NDKEvent, NDKUser, NDKFilter, NDKSubscription, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { CommunicationProvider } from './communication-provider';
import { User, EscrowContract } from './types';

/**
 * Custom event kinds for Ark Escrow
 * Using replaceable event kinds (30000+) for user data and contracts
 */
const ARK_EVENT_KINDS = {
    USER_PROFILE: 30000,      // Ark user profile (replaceable)
    CONTRACT: 30001,          // Ark escrow contract (replaceable)
    PENDING_TX: 30002,        // Pending transaction update (replaceable)
    CONTRACT_UPDATE: 1337,    // Contract status updates (ephemeral)
    TX_ACK: 1338,            // Transaction acknowledgments (ephemeral)
} as const;

/**
 * Default Nostr relays for Ark Escrow
 */
const DEFAULT_RELAYS = [
    'wss://nostr.arkade.sh',
];

/**
 * Nostr communication provider for Ark Escrow
 * Implements real-time, decentralized communication using the Nostr protocol
 */
export class NostrCommunication implements CommunicationProvider {
    private ndk: NDK;
    private userCallbacks: ((users: User[]) => void)[] = [];
    private contractCallbacks: ((contracts: EscrowContract[]) => void)[] = [];
    private pendingTxCallbacks: ((contractId: string, transaction: any) => void)[] = [];
    
    private userSubscription?: NDKSubscription;
    private contractSubscription?: NDKSubscription;
    private pendingTxSubscription?: NDKSubscription;
    
    private currentUser?: NDKUser;
    private relayUrls: string[];
    private privateKey?: string;

    constructor(relayUrls?: string[], privateKey?: string) {
        this.relayUrls = relayUrls || DEFAULT_RELAYS;
        this.privateKey = privateKey;
        this.ndk = new NDK({
            explicitRelayUrls: this.relayUrls,
            outboxRelayUrls: this.relayUrls,
        });
    }

    async initialize(): Promise<void> {
        try {
            // Set up private key signer if provided
            if (this.privateKey) {
                const signer = new NDKPrivateKeySigner(this.privateKey);
                this.ndk.signer = signer;
                this.currentUser = await signer.user();
            }
            
            // Connect to Nostr relays
            await this.ndk.connect();
            console.log(`Connected to ${this.ndk.pool.connectedRelays().length} Nostr relays`);

            // Log authentication status
            if (this.currentUser) {
                console.log('Nostr user authenticated with private key signer:', this.currentUser.pubkey);
            } else {
                console.warn('No Nostr private key provided - Nostr functionality will be limited');
            }

            // Set up subscriptions for real-time updates
            await this.setupSubscriptions();
            
            console.log('Nostr communication provider initialized');
        } catch (error) {
            console.error('Failed to initialize Nostr communication:', error);
            throw error;
        }
    }

    cleanup(): void {
        // Close all subscriptions
        this.userSubscription?.stop();
        this.contractSubscription?.stop();
        this.pendingTxSubscription?.stop();
        
        // Clear callbacks
        this.userCallbacks = [];
        this.contractCallbacks = [];
        this.pendingTxCallbacks = [];
        
        console.log('Nostr communication provider cleaned up');
    }

    // User Discovery Methods
    async publishUser(user: User): Promise<void> {
        if (!this.currentUser) {
            throw new Error('No authenticated Nostr user');
        }

        try {
            // Create a replaceable event for the user profile
            const event = new NDKEvent(this.ndk, {
                kind: ARK_EVENT_KINDS.USER_PROFILE,
                content: JSON.stringify({
                    name: user.name,
                    pubkey: user.pubkey,
                    address: user.address,
                    timestamp: Date.now(),
                }),
                tags: [
                    ['d', user.pubkey], // 'd' tag makes this a replaceable event
                    ['ark-user', user.pubkey],
                    ['ark-name', user.name],
                ],
            });

            await event.sign();
            await event.publish();
            
            console.log('Published Ark user to Nostr:', user.name);
        } catch (error) {
            console.error('Failed to publish user to Nostr:', error);
            throw error;
        }
    }

    subscribeToUsers(callback: (users: User[]) => void): void {
        this.userCallbacks.push(callback);
    }

    async getUsers(): Promise<User[]> {
        try {
            const filter: NDKFilter = {
                kinds: [ARK_EVENT_KINDS.USER_PROFILE as number],
                '#ark-user': undefined, // Get all ark users
            };

            const events = await this.ndk.fetchEvents(filter);
            const users: User[] = [];

            for (const event of events) {
                try {
                    const userData = JSON.parse(event.content);
                    users.push({
                        pubkey: userData.pubkey,
                        name: userData.name,
                        address: userData.address,
                        timestamp: userData.timestamp || Date.now(),
                    });
                } catch (error) {
                    console.warn('Failed to parse user event:', error);
                }
            }

            return users;
        } catch (error) {
            console.error('Failed to fetch users from Nostr:', error);
            return [];
        }
    }

    // Contract Sharing Methods
    async publishContract(contract: EscrowContract): Promise<void> {
        if (!this.currentUser) {
            throw new Error('No authenticated Nostr user');
        }

        try {
            // Create a replaceable event for the contract
            const event = new NDKEvent(this.ndk, {
                kind: ARK_EVENT_KINDS.CONTRACT,
                content: JSON.stringify({
                    arkAddress: contract.arkAddress,
                    buyer: contract.buyer,
                    seller: contract.seller,
                    arbitrator: contract.arbitrator,
                    description: contract.description,
                    timestamp: contract.timestamp,
                    pendingTransaction: contract.pendingTransaction,
                }),
                tags: [
                    ['d', contract.arkAddress], // 'd' tag makes this a replaceable event
                    ['ark-contract', contract.arkAddress],
                    ['p', contract.buyer.pubkey],    // Tag participants
                    ['p', contract.seller.pubkey],
                    ['p', contract.arbitrator.pubkey],
                ],
            });

            await event.sign();
            await event.publish();
            
            console.log('Published Ark contract to Nostr:', contract.arkAddress);
        } catch (error) {
            console.error('Failed to publish contract to Nostr:', error);
            throw error;
        }
    }

    subscribeToContracts(callback: (contracts: EscrowContract[]) => void): void {
        this.contractCallbacks.push(callback);
    }

    async getContracts(): Promise<EscrowContract[]> {
        if (!this.currentUser) {
            return [];
        }

        try {
            const filter: NDKFilter = {
                kinds: [ARK_EVENT_KINDS.CONTRACT as number],
                '#p': [this.currentUser.pubkey], // Only contracts where current user is a participant
            };

            const events = await this.ndk.fetchEvents(filter);
            const contracts: EscrowContract[] = [];

            for (const event of events) {
                try {
                    const contractData = JSON.parse(event.content);
                    contracts.push(contractData);
                } catch (error) {
                    console.warn('Failed to parse contract event:', error);
                }
            }

            return contracts;
        } catch (error) {
            console.error('Failed to fetch contracts from Nostr:', error);
            return [];
        }
    }

    async updateContract(contract: EscrowContract): Promise<void> {
        // Same as publishContract for Nostr - replaceable events handle updates
        await this.publishContract(contract);
    }

    // Pending Transaction Notifications
    async notifyPendingTransaction(contractId: string, transaction: any): Promise<void> {
        if (!this.currentUser) {
            throw new Error('No authenticated Nostr user');
        }

        try {
            // Create an ephemeral event for the pending transaction notification
            const event = new NDKEvent(this.ndk, {
                kind: ARK_EVENT_KINDS.CONTRACT_UPDATE,
                content: JSON.stringify({
                    contractId,
                    transaction,
                    timestamp: Date.now(),
                    type: 'pending_transaction_update',
                }),
                tags: [
                    ['ark-contract', contractId],
                    ['ark-update-type', 'pending_transaction'],
                ],
            });

            await event.sign();
            await event.publish();
            
            console.log('Notified pending transaction update via Nostr:', contractId);
        } catch (error) {
            console.error('Failed to notify pending transaction via Nostr:', error);
            throw error;
        }
    }

    subscribeToPendingTransactions(callback: (contractId: string, transaction: any) => void): void {
        this.pendingTxCallbacks.push(callback);
    }

    // Private helper methods
    private async setupSubscriptions(): Promise<void> {
        if (!this.currentUser) {
            console.warn('No authenticated user, skipping subscriptions');
            return;
        }

        // Subscribe to user profile updates
        this.userSubscription = this.ndk.subscribe({
            kinds: [ARK_EVENT_KINDS.USER_PROFILE as number],
        });

        this.userSubscription.on('event', (event: NDKEvent) => {
            this.handleUserEvent(event);
        });

        // Subscribe to contract updates for current user
        this.contractSubscription = this.ndk.subscribe({
            kinds: [ARK_EVENT_KINDS.CONTRACT as number],
            '#p': [this.currentUser.pubkey],
        });

        this.contractSubscription.on('event', (event: NDKEvent) => {
            this.handleContractEvent(event);
        });

        // Subscribe to pending transaction notifications
        this.pendingTxSubscription = this.ndk.subscribe({
            kinds: [ARK_EVENT_KINDS.CONTRACT_UPDATE as number],
            '#ark-update-type': ['pending_transaction'],
        });

        this.pendingTxSubscription.on('event', (event: NDKEvent) => {
            this.handlePendingTxEvent(event);
        });

        console.log('Nostr subscriptions established');
    }

    private async handleUserEvent(_event: NDKEvent): Promise<void> {
        try {
            const users = await this.getUsers();
            this.userCallbacks.forEach(callback => {
                try {
                    callback(users);
                } catch (error) {
                    console.error('Error in user callback:', error);
                }
            });
        } catch (error) {
            console.error('Error handling user event:', error);
        }
    }

    private async handleContractEvent(_event: NDKEvent): Promise<void> {
        try {
            const contracts = await this.getContracts();
            this.contractCallbacks.forEach(callback => {
                try {
                    callback(contracts);
                } catch (error) {
                    console.error('Error in contract callback:', error);
                }
            });
        } catch (error) {
            console.error('Error handling contract event:', error);
        }
    }

    private handlePendingTxEvent(event: NDKEvent): void {
        try {
            const data = JSON.parse(event.content);
            if (data.type === 'pending_transaction_update') {
                this.pendingTxCallbacks.forEach(callback => {
                    try {
                        callback(data.contractId, data.transaction);
                    } catch (error) {
                        console.error('Error in pending transaction callback:', error);
                    }
                });
            }
        } catch (error) {
            console.error('Error handling pending transaction event:', error);
        }
    }

    // Utility methods
    getCurrentUser(): NDKUser | undefined {
        return this.currentUser;
    }

    getConnectedRelays(): string[] {
        return Array.from(this.ndk.pool.connectedRelays()).map((relay: any) => relay.url);
    }

    async sendAcknowledgment(contractId: string, transactionId: string): Promise<void> {
        if (!this.currentUser) {
            throw new Error('No authenticated Nostr user');
        }

        try {
            const event = new NDKEvent(this.ndk, {
                kind: ARK_EVENT_KINDS.TX_ACK,
                content: JSON.stringify({
                    contractId,
                    transactionId,
                    timestamp: Date.now(),
                    type: 'transaction_acknowledgment',
                }),
                tags: [
                    ['ark-contract', contractId],
                    ['ark-tx', transactionId],
                    ['ark-ack', 'true'],
                ],
            });

            await event.sign();
            await event.publish();
            
            console.log('Sent transaction acknowledgment via Nostr');
        } catch (error) {
            console.error('Failed to send acknowledgment via Nostr:', error);
            throw error;
        }
    }
}
