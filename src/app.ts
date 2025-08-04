import { NotificationManager } from './notification-manager';
import { ServerManager } from './server-manager';
import { WalletManager } from './wallet-manager';
import { UserManager } from './user-manager';
import { ContractManager } from './contract-manager';
import { UIManager } from './ui-manager';
import { RelativeTimelock } from '@arkade-os/sdk';
import { CommunicationManager } from './communication-manager';

export class ArkEscrowApp {
    private notificationManager!: NotificationManager;
    private serverManager!: ServerManager;
    private walletManager!: WalletManager;
    private userManager!: UserManager;
    private contractManager!: ContractManager;
    private uiManager!: UIManager;
    private communicationManager!: CommunicationManager;
    private elements!: any;

    constructor() {
        this.initializeElements();
        this.initializeApp();
    }

    private async initializeApp(): Promise<void> {
        await this.initializeManagers();
        this.setupEventListeners();
        this.setupCrossTabSync();
    }

    private initializeElements(): void {
        this.elements = {
            // Server
            arkServerUrl: document.getElementById('arkServerUrl') as HTMLInputElement,
            connectServer: document.getElementById('connectServer') as HTMLButtonElement,
            serverStatus: document.getElementById('serverStatus') as HTMLDivElement,
            
            // Wallet
            createWallet: document.getElementById('createWallet') as HTMLButtonElement,
            importWallet: document.getElementById('importWallet') as HTMLButtonElement,
            importForm: document.getElementById('importForm') as HTMLDivElement,
            privateKey: document.getElementById('privateKey') as HTMLInputElement,
            confirmImport: document.getElementById('confirmImport') as HTMLButtonElement,
            cancelImport: document.getElementById('cancelImport') as HTMLButtonElement,
            walletInfo: document.getElementById('walletInfo') as HTMLDivElement,
            walletAddress: document.getElementById('walletAddress') as HTMLSpanElement,
            walletPubkey: document.getElementById('walletPubkey') as HTMLSpanElement,
            walletPrivkey: document.getElementById('walletPrivkey') as HTMLSpanElement,
            walletBalance: document.getElementById('walletBalance') as HTMLSpanElement,
            copyAddress: document.getElementById('copyAddress') as HTMLButtonElement,
            copyPrivkey: document.getElementById('copyPrivkey') as HTMLButtonElement,
            hidePrivkey: document.getElementById('hidePrivkey') as HTMLButtonElement,
            refreshBalance: document.getElementById('refreshBalance') as HTMLButtonElement,
            
            // Transactions
            settleBtn: document.getElementById('settleBtn') as HTMLButtonElement,
            sendBtn: document.getElementById('sendBtn') as HTMLButtonElement,
            sendForm: document.getElementById('sendForm') as HTMLDivElement,
            sendAddress: document.getElementById('sendAddress') as HTMLInputElement,
            sendAmount: document.getElementById('sendAmount') as HTMLInputElement,
            confirmSend: document.getElementById('confirmSend') as HTMLButtonElement,
            cancelSend: document.getElementById('cancelSend') as HTMLButtonElement,
            
            // Users
            refreshUsers: document.getElementById('refreshUsers') as HTMLButtonElement,
            usersList: document.getElementById('usersList') as HTMLDivElement,
            
            // Contracts
            buyerSelect: document.getElementById('buyerSelect') as HTMLSelectElement,
            sellerSelect: document.getElementById('sellerSelect') as HTMLSelectElement,
            arbitratorSelect: document.getElementById('arbitratorSelect') as HTMLSelectElement,
            contractDescription: document.getElementById('contractDescription') as HTMLInputElement,
            createContract: document.getElementById('createContract') as HTMLButtonElement,
            refreshContracts: document.getElementById('refreshContracts') as HTMLButtonElement,
            contractsList: document.getElementById('contractsList') as HTMLDivElement,
            
            // Notifications
            notifications: document.getElementById('notifications') as HTMLDivElement,
        };
    }

    private async initializeManagers(): Promise<void> {
        this.notificationManager = new NotificationManager();
        this.serverManager = new ServerManager(this.notificationManager);
        this.walletManager = new WalletManager(this.notificationManager, this.serverManager);
        
        // Initialize communication manager with localStorage by default
        // Will switch to Nostr when wallet is available
        this.communicationManager = new CommunicationManager({ type: 'localStorage' });
        await this.communicationManager.initialize();
        const communicationProvider = this.communicationManager.getProvider();
        
        this.userManager = new UserManager(this.notificationManager, communicationProvider);
        this.contractManager = new ContractManager(this.notificationManager, this.userManager, this.serverManager, this.walletManager, communicationProvider);
        this.uiManager = new UIManager(
            this.elements,
            this.walletManager,
            this.userManager,
            this.contractManager,
            this.serverManager
        );
    }

    private setupEventListeners(): void {
        // Server
        this.elements.connectServer.addEventListener('click', () => this.connectToServer());
        
        // Wallet
        this.elements.createWallet.addEventListener('click', () => this.createWallet());
        this.elements.importWallet.addEventListener('click', () => this.uiManager.showImportForm());
        this.elements.confirmImport.addEventListener('click', () => this.importWallet());
        this.elements.cancelImport.addEventListener('click', () => this.uiManager.hideImportForm());
        this.elements.copyAddress.addEventListener('click', () => this.uiManager.copyAddress());
        this.elements.copyPrivkey.addEventListener('click', () => this.uiManager.copyPrivkey());
        this.elements.hidePrivkey.addEventListener('click', () => this.uiManager.togglePrivkeyVisibility());
        this.elements.refreshBalance.addEventListener('click', () => this.refreshBalance());
        
        // Transactions
        this.elements.settleBtn.addEventListener('click', () => this.settle());
        this.elements.sendBtn.addEventListener('click', () => this.uiManager.showSendForm());
        this.elements.confirmSend.addEventListener('click', () => this.sendTransaction());
        this.elements.cancelSend.addEventListener('click', () => this.uiManager.hideSendForm());
        
        // Users
        this.elements.refreshUsers.addEventListener('click', () => this.uiManager.updateUsersUI());
        
        // Contracts
        this.elements.createContract.addEventListener('click', () => this.createEscrowContract());
        this.elements.refreshContracts.addEventListener('click', () => this.uiManager.updateContractsUI());
        
        // Keyboard shortcuts
        this.elements.privateKey.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.importWallet();
        });
        
        this.elements.sendAddress.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.elements.sendAmount.focus();
        });
        
        this.elements.sendAmount.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'Enter') this.sendTransaction();
        });
        
        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('unload', () => this.cleanup());
        // document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }

    private setupCrossTabSync(): void {
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (event) => {
            if (event.key === 'arkUsers') {
                console.log('Users updated in another tab, syncing...');
                this.uiManager.updateUsersUI();
            } else if (event.key === 'arkContracts') {
                console.log('Contracts updated in another tab, syncing...');
                this.uiManager.updateContractsUI();
            } else if (event.key === 'ark-partial-transactions') {
                console.log('Partial transactions updated in another tab, syncing...');
                this.uiManager.updateContractsUI();
            }
        });
        
        // Periodic sync to ensure data stays updated
        setInterval(() => {
            this.uiManager.updateUsersUI();
            this.uiManager.updateContractsUI();
            this.refreshBalance();
        }, 10000); // Increased to 10 seconds to reduce load
    }

    private async connectToServer(): Promise<void> {
        // Check if already connected (disconnect flow)
        if (this.serverManager.isServerConnected()) {
            await this.disconnectFromServer();
            return;
        }
        
        const url = this.elements.arkServerUrl.value.trim();
        this.serverManager.setServerUrl(url);
        
        const connected = await this.serverManager.connectToServer();
        if (connected) {
            // Update the UI to reflect connected state
            this.uiManager.updateServerUI(true);
            this.uiManager.showMainUI();
        }
    }
    
    private async disconnectFromServer(): Promise<void> {
        // Reset the server manager state
        this.serverManager.reset();
        
        // Reset wallet state if exists
        const wallet = this.walletManager.getCurrentWallet();
        if (wallet) {
            // Unregister user if connected
            this.userManager.unregisterUser(wallet);
            // Reset wallet state
            this.walletManager.resetWallet();
        }
        
        // Update the UI to reflect disconnected state
        this.uiManager.updateServerUI(false);
        
        // Hide wallet UI sections
        this.uiManager.hideMainUI();
        this.uiManager.updateWalletDependentUI();
        
        // Show notification
        this.notificationManager.showInfo('Disconnected from Ark server');
    }

    private async createWallet(): Promise<void> {
        // Refresh user data before creating wallet to ensure name allocation isn't stale
        this.userManager.refreshUsers();
        
        await this.walletManager.createWallet();
        this.uiManager.updateWalletUI();
        this.uiManager.updateBalanceUI();
        this.uiManager.updateWalletDependentUI();
    }

    private async importWallet(): Promise<void> {
        const privateKey = this.elements.privateKey.value;
        await this.walletManager.importWallet(privateKey);
        this.uiManager.hideImportForm();
        this.uiManager.updateWalletUI();
        this.uiManager.updateBalanceUI();
        this.uiManager.updateWalletDependentUI();
    }

    private async refreshBalance(): Promise<void> {
        try {
            const balance = await this.walletManager.refreshBalance();
            this.uiManager.updateBalanceUI(balance);
        } catch (error) {
            // Error already handled in WalletManager
        }
    }

    private async settle(): Promise<void> {
        await this.walletManager.settle();
        this.refreshBalance();
    }

    private async sendTransaction(): Promise<void> {
        const address = this.elements.sendAddress.value;
        const amount = parseFloat(this.elements.sendAmount.value);
        
        await this.walletManager.sendTransaction(address, amount);
        this.uiManager.hideSendForm();
        this.refreshBalance();
    }

    private async createEscrowContract(): Promise<void> {
        const buyerId = this.elements.buyerSelect.value;
        const sellerId = this.elements.sellerSelect.value;
        const arbitratorId = this.elements.arbitratorSelect.value;
        const description = this.elements.contractDescription.value;
        const currentWallet = this.walletManager.getCurrentWallet();
        
        // Get server info to fetch the unilateral exit delay
        const serverInfo = await this.serverManager.getProvider()?.getInfo();
        if (!serverInfo) {
            this.notificationManager.showError('Not connected to server');
            return;
        }
        
        // Convert server's unilateralExitDelay to RelativeTimelock object
        const unilateralDelay: RelativeTimelock = {
            type: serverInfo.unilateralExitDelay < 512 ? "blocks" : "seconds",
            value: serverInfo.unilateralExitDelay,
        };
        await this.contractManager.createEscrowContract(
            buyerId,
            sellerId,
            arbitratorId,
            description,
            currentWallet,
            unilateralDelay
        );
        
        this.uiManager.clearContractForm();
        this.uiManager.updateContractsUI();
    }

    async executeContractAction(contractIndex: number, action: string): Promise<void> {
        const currentWallet = this.walletManager.getCurrentWallet();
        if (!currentWallet) {
            this.notificationManager.showError('Wallet not found');
            return;
        }
        
        // Get user-specific contracts (same filtering as UI)
        const contracts = this.contractManager.getContractsForUser(currentWallet.pubkey);
        const contract = contracts[contractIndex];
        
        if (!contract) {
            this.notificationManager.showError('Contract not found');
            return;
        }
        
        await this.contractManager.executeContractAction(contract, action, currentWallet);
        
        // Refresh the contracts UI after action
        this.uiManager.updateContractsUI();
    }

    async approvePendingTransaction(contractIndex: number): Promise<void> {
        const currentWallet = this.walletManager.getCurrentWallet();
        if (!currentWallet) {
            this.notificationManager.showError('Wallet not found');
            return;
        }
        
        // Get user-specific contracts (same filtering as UI)
        const contracts = this.contractManager.getContractsForUser(currentWallet.pubkey);
        const contract = contracts[contractIndex];
        
        if (!contract) {
            this.notificationManager.showError('Contract not found');
            return;
        }
        
        await this.contractManager.approvePendingTransaction(contract, currentWallet);
        
        // Refresh the contracts UI after approval
        this.uiManager.updateContractsUI();
    }

    async rejectPendingTransaction(contractIndex: number): Promise<void> {
        const currentWallet = this.walletManager.getCurrentWallet();
        if (!currentWallet) {
            this.notificationManager.showError('Wallet not found');
            return;
        }
        
        // Get user-specific contracts (same filtering as UI)
        const contracts = this.contractManager.getContractsForUser(currentWallet.pubkey);
        const contract = contracts[contractIndex];
        
        if (!contract) {
            this.notificationManager.showError('Contract not found');
            return;
        }
        
        await this.contractManager.rejectPendingTransaction(contract, currentWallet);
        
        // Refresh the contracts UI after rejection
        this.uiManager.updateContractsUI();
    }

    private cleanup(): void {
        const wallet = this.walletManager.getCurrentWallet();
        if (wallet) {
            // Try to unregister synchronously if possible
            this.userManager.unregisterUser(wallet);
        }
    }

    private handleVisibilityChange(): void {
        const wallet = this.walletManager.getCurrentWallet();
        
        if (document.visibilityState === 'hidden') {
            this.userManager.unregisterUser(wallet);
        } else if (document.visibilityState === 'visible' && wallet) {
            this.userManager.autoRegisterUser(wallet);
        }
    }

    async initialize(): Promise<void> {
        // Use mutinynet.arkade.sh as the default server
        const defaultServer = 'https://mutinynet.arkade.sh';
        const savedUrl = this.serverManager.getSavedServerUrl() || defaultServer;
        
        // Set the server URL in the input field
        this.elements.arkServerUrl.value = savedUrl;
        
        // Connect automatically
        const connected = await this.serverManager.connectToServer(savedUrl);
        if (connected) {
            // Update the UI to reflect connected state
            this.uiManager.updateServerUI(true);
            this.uiManager.showMainUI();
        } else {
            this.uiManager.hideMainUI();
            this.notificationManager.showInfo('Failed to connect to default server. Please check your connection and try again.');
        }
        
        this.uiManager.updateUsersUI();
        this.uiManager.updateContractsUI();
        this.uiManager.updateWalletDependentUI();
        
        // Auto-refresh users and contracts every 5 seconds
        setInterval(() => {
            if (this.serverManager.isServerConnected()) {
                this.uiManager.updateUsersUI();
                this.uiManager.updateContractsUI();
            }
        }, 5000);
    }
}

// Make executeContractAction global for onclick handlers
(window as any).executeContractAction = async function(address: string, action: string) {
    // This will be handled by the ContractManager instance
    // For now, we'll create a simple implementation
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        // You would need to access the app instance here for proper implementation
        console.log(`${action} executed for ${address}`);
    } catch (error) {
        console.error(`Failed to execute ${action}`, error);
    }
};
