import { User, EscrowContract, WalletInfo } from './types.ts';
import { NotificationManager } from './notification-manager';
import { CommunicationProvider } from './communication-provider';

export class UserManager {
    private users: Map<string, User> = new Map();
    private notificationManager: NotificationManager;
    private communicationProvider: CommunicationProvider;
    private friendlyNames: string[] = [
        'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi',
        'Ivan', 'Judy', 'Mallory', 'Oscar', 'Peggy', 'Quentin', 'Rupert',
        'Sybil', 'Trent', 'Ursula', 'Victor', 'Walter', 'Xavier', 'Yvonne', 'Zeke'
    ];
    private usedNames: Set<string> = new Set();

    constructor(notificationManager: NotificationManager, communicationProvider: CommunicationProvider) {
        this.notificationManager = notificationManager;
        this.communicationProvider = communicationProvider;
        this.initializeUsers();
    }

    private async initializeUsers(): Promise<void> {
        // Subscribe to user updates from communication provider
        this.communicationProvider.subscribeToUsers((users) => {
            this.updateUsersFromProvider(users);
        });
        
        // Load initial users
        await this.loadUsers();;
    }

    /**
     * Update local users map when communication provider notifies of changes
     */
    private updateUsersFromProvider(users: User[]): void {
        this.users.clear();
        users.forEach(user => {
            this.users.set(user.pubkey, user);
        });
        this.buildUsedNamesSet();
    }

    async autoRegisterUser(walletInfo: WalletInfo): Promise<void> {
        // Check if user already exists
        if (this.users.has(walletInfo.pubkey)) {
            return;
        }
        
        // Get or assign a friendly name for this user
        const friendlyName = this.assignFriendlyName();
        
        const user: User = {
            name: friendlyName,
            pubkey: walletInfo.pubkey,
            address: walletInfo.arkAddress,
            timestamp: Date.now()
        };

        this.users.set(user.pubkey, user);
        await this.saveUsers();
        this.notificationManager.showSuccess(`User registered: ${user.name}`);
    }

    async unregisterUser(walletInfo: WalletInfo | null): Promise<void> {
        if (!walletInfo) return;
        
        if (this.users.has(walletInfo.pubkey)) {
            const user = this.users.get(walletInfo.pubkey);
            this.users.delete(walletInfo.pubkey);
            await this.saveUsers();
            this.notificationManager.showInfo(`User unregistered: ${user?.name}`);
        }
    }

    getUsers(): User[] {
        return Array.from(this.users.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Force reload users from communication provider
     * This is useful when refreshing users across tabs/devices
     */
    async refreshUsers(): Promise<void> {
        await this.loadUsers();
    }

    getUserById(id: string): User | null {
        return this.users.get(id) || null;
    }

    getCurrentUserRole(contract: EscrowContract, currentWallet: WalletInfo | null): string | null {
        if (!currentWallet) return null;

        const currentPubkey = currentWallet.pubkey;
        
        if (contract.buyer.pubkey === currentPubkey) return 'buyer';
        if (contract.seller.pubkey === currentPubkey) return 'seller';
        if (contract.arbitrator.pubkey === currentPubkey) return 'arbitrator';
        
        return null;
    }

    private async loadUsers(): Promise<void> {
        try {
            const users = await this.communicationProvider.getUsers();
            this.users.clear();
            users.forEach(user => {
                this.users.set(user.pubkey, user);

            });
            
        this.buildUsedNamesSet()
        } catch (error) {
            console.error('Failed to load users from communication provider:', error);
        }
    }

    private async saveUsers(): Promise<void> {
        try {
            // Publish all users to the communication provider
            const users = Array.from(this.users.values());
            for (const user of users) {
                await this.communicationProvider.publishUser(user);
            }
        } catch (error) {
            console.error('Failed to save users to communication provider:', error);
        }
    }

    /**
     * Assign the next available friendly name
     * @returns A friendly name
     */
    private assignFriendlyName(): string {
        // Find an available name
        for (const name of this.friendlyNames) {
            if (!this.usedNames.has(name)) {
                this.usedNames.add(name);
                return name;
            }
        }
        
        // If all names are used, add a number suffix
        let counter = 1;
        while (true) {
            const candidateName = `${this.friendlyNames[0]} ${counter}`;
            if (!this.usedNames.has(candidateName)) {
                this.usedNames.add(candidateName);
                return candidateName;
            }
            counter++;
        }
    }

    /**
     * Build the used names set from existing users
     */
    private buildUsedNamesSet(): void {
        this.usedNames.clear();
        for (const user of this.users.values()) {
            this.usedNames.add(user.name);
        }
    }
}
