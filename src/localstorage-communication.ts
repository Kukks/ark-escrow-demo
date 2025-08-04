import { CommunicationProvider } from './communication-provider';
import { User, EscrowContract } from './types';

/**
 * LocalStorage-based communication provider for cross-tab synchronization
 * Uses localStorage and storage events for real-time updates across browser tabs
 */
export class LocalStorageCommunication implements CommunicationProvider {
    private userCallbacks: ((users: User[]) => void)[] = [];
    private contractCallbacks: ((contracts: EscrowContract[]) => void)[] = [];
    private pendingTxCallbacks: ((contractId: string, transaction: any) => void)[] = [];
    private storageListener?: (event: StorageEvent) => void;

    constructor() {
        // LocalStorage implementation doesn't need configuration
    }

    async initialize(): Promise<void> {
        // Set up storage event listener for cross-tab sync
        this.storageListener = (event: StorageEvent) => {
            if (event.key === 'arkUsers') {
                console.log('Users updated in another tab, syncing...');
                this.notifyUserCallbacks();
            } else if (event.key === 'arkContracts') {
                console.log('Contracts updated in another tab, syncing...');
                this.notifyContractCallbacks();
            } else if (event.key === 'ark-partial-transactions') {
                console.log('Partial transactions updated in another tab, syncing...');
                this.notifyContractCallbacks(); // Contracts include pending transactions
            }
        };
        
        window.addEventListener('storage', this.storageListener);
        console.log('LocalStorage communication provider initialized');
    }

    cleanup(): void {
        if (this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
        }
        this.userCallbacks = [];
        this.contractCallbacks = [];
        this.pendingTxCallbacks = [];
        console.log('LocalStorage communication provider cleaned up');
    }

    // User Discovery Methods
    async publishUser(user: User): Promise<void> {
        try {
            const users = await this.getUsers();
            const existingIndex = users.findIndex(u => u.pubkey === user.pubkey);
            
            if (existingIndex >= 0) {
                users[existingIndex] = user; // Update existing user
            } else {
                users.push(user); // Add new user
            }
            
            localStorage.setItem('ark-escrow-users', JSON.stringify(users));
            localStorage.setItem('arkUsers', Date.now().toString()); // Trigger cross-tab sync
            
            this.notifyUserCallbacks();
        } catch (error) {
            console.error('Failed to publish user:', error);
            throw error;
        }
    }

    subscribeToUsers(callback: (users: User[]) => void): void {
        this.userCallbacks.push(callback);
        
        // Immediately call with current users
        this.getUsers().then(users => callback(users)).catch(console.error);
    }

    async getUsers(): Promise<User[]> {
        try {
            const stored = localStorage.getItem('ark-escrow-users');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load users from localStorage:', error);
            return [];
        }
    }

    // Contract Sharing Methods
    async publishContract(contract: EscrowContract): Promise<void> {
        try {
            const contracts = await this.getContracts();
            const existingIndex = contracts.findIndex(c => c.arkAddress === contract.arkAddress);
            
            if (existingIndex >= 0) {
                contracts[existingIndex] = contract; // Update existing contract
            } else {
                contracts.push(contract); // Add new contract
            }
            
            localStorage.setItem('arkContracts', JSON.stringify(contracts));
            
            this.notifyContractCallbacks();
        } catch (error) {
            console.error('Failed to publish contract:', error);
            throw error;
        }
    }

    subscribeToContracts(callback: (contracts: EscrowContract[]) => void): void {
        this.contractCallbacks.push(callback);
        
        // Immediately call with current contracts
        this.getContracts().then(contracts => callback(contracts)).catch(console.error);
    }

    async getContracts(): Promise<EscrowContract[]> {
        try {
            const stored = localStorage.getItem('arkContracts');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load contracts from localStorage:', error);
            return [];
        }
    }

    async updateContract(contract: EscrowContract): Promise<void> {
        // Same as publishContract for localStorage implementation
        await this.publishContract(contract);
    }

    // Pending Transaction Methods
    async notifyPendingTransaction(contractId: string, transaction: any): Promise<void> {
        // For localStorage, pending transactions are stored within contracts
        // So we trigger contract callbacks to notify about pending transaction changes
        this.notifyContractCallbacks();
        
        // Also notify specific pending transaction callbacks
        this.pendingTxCallbacks.forEach(callback => {
            try {
                callback(contractId, transaction);
            } catch (error) {
                console.error('Error in pending transaction callback:', error);
            }
        });
    }

    subscribeToPendingTransactions(callback: (contractId: string, transaction: any) => void): void {
        this.pendingTxCallbacks.push(callback);
    }

    // Private helper methods
    private async notifyUserCallbacks(): Promise<void> {
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
            console.error('Failed to notify user callbacks:', error);
        }
    }

    private async notifyContractCallbacks(): Promise<void> {
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
            console.error('Failed to notify contract callbacks:', error);
        }
    }
}
