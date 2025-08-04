import { User, EscrowContract } from './types';

/**
 * Interface for communication providers that handle cross-tab/cross-device synchronization
 * of user discovery, contract sharing, and pending transaction notifications.
 * 
 * Local data (private keys, server URLs) remains in localStorage.
 */
export interface CommunicationProvider {
    /**
     * Initialize the communication provider
     */
    initialize(): Promise<void>;

    /**
     * Clean up resources when shutting down
     */
    cleanup(): void;

    // User Discovery
    /**
     * Publish/register a user for discovery by others
     */
    publishUser(user: User): Promise<void>;

    /**
     * Subscribe to user discovery updates
     */
    subscribeToUsers(callback: (users: User[]) => void): void;

    /**
     * Get all currently known users
     */
    getUsers(): Promise<User[]>;

    // Contract Sharing
    /**
     * Publish a new contract for sharing with participants
     */
    publishContract(contract: EscrowContract): Promise<void>;

    /**
     * Subscribe to contract updates
     */
    subscribeToContracts(callback: (contracts: EscrowContract[]) => void): void;

    /**
     * Get all contracts relevant to the current user
     */
    getContracts(): Promise<EscrowContract[]>;

    /**
     * Update a contract (e.g., pending transaction changes)
     */
    updateContract(contract: EscrowContract): Promise<void>;

    // Pending Transaction Notifications
    /**
     * Notify about a pending transaction that requires action
     */
    notifyPendingTransaction(contractId: string, transaction: any): Promise<void>;

    /**
     * Subscribe to pending transaction notifications
     */
    subscribeToPendingTransactions(callback: (contractId: string, transaction: any) => void): void;
}



/**
 * Events that can be emitted by communication providers
 */
export type CommunicationEvent = 
    | { type: 'users_updated'; users: User[] }
    | { type: 'contracts_updated'; contracts: EscrowContract[] }
    | { type: 'pending_transaction'; contractId: string; transaction: any }
    | { type: 'connection_status'; connected: boolean }
    | { type: 'error'; error: string };

/**
 * Event callback type
 */
export type CommunicationEventCallback = (event: CommunicationEvent) => void;
