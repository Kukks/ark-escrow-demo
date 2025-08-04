import { hex } from '@scure/base';
import { SingleKey, Wallet } from '@arkade-os/sdk';
import { WalletInfo } from './types.ts';
import { NotificationManager } from './notification-manager';
import { ServerManager } from './server-manager';

export class WalletManager {
    private currentWallet: WalletInfo | null = null;
    private notificationManager: NotificationManager;
    private serverManager: ServerManager;

    constructor(notificationManager: NotificationManager, serverManager: ServerManager) {
        this.notificationManager = notificationManager;
        this.serverManager = serverManager;
    }

    private generateRandomBytes(length: number): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    async generateWallet(): Promise<WalletInfo> {
        const provider = this.serverManager.getProvider();
        if (!provider) {
            throw new Error('Server not connected');
        }

        const privateKeyBytes = this.generateRandomBytes(32);
        const privateKeyHex = hex.encode(privateKeyBytes);
        
        const identity = SingleKey.fromPrivateKey(privateKeyBytes);
        const wallet = await Wallet.create({
            identity,
            arkServerUrl: provider.serverUrl
        })
        
        const arkAddress = await wallet.getAddress();
        const boardingAddress = await wallet.getBoardingAddress();
        const pubkey = hex.encode(identity.xOnlyPublicKey());
        
        return {
            wallet,
            identity,
            arkAddress,
            boardingAddress,
            pubkey,
            privateKey: privateKeyHex
        };
    }

    async createWallet(): Promise<void> {
        try {
            const walletInfo = await this.generateWallet();
            this.currentWallet = walletInfo;
            this.notificationManager.showSuccess('Wallet created successfully!');
        } catch (error) {
            console.error('Failed to create wallet:', error);
            this.notificationManager.showError('Failed to create wallet');
        }
    }

    async importWallet(privateKeyHex: string): Promise<void> {
        if (!privateKeyHex.trim()) {
            this.notificationManager.showError('Please enter a private key');
            return;
        }

        try {
            const provider = this.serverManager.getProvider();
            if (!provider) {
                throw new Error('Server not connected');
            }

            const identity = SingleKey.fromHex(privateKeyHex.trim());
            const wallet = await Wallet.create({
                identity,
                arkServerUrl: provider.serverUrl
            })
            
            const arkAddress = await wallet.getAddress();
            const boardingAddress = await wallet.getBoardingAddress();
            const pubkey = hex.encode(identity.xOnlyPublicKey());
            
            this.currentWallet = {
                wallet,
                identity,
                arkAddress,
                boardingAddress,
                pubkey,
                privateKey: privateKeyHex.trim()
            };
            
            this.notificationManager.showSuccess('Wallet imported successfully!');
        } catch (error) {
            console.error('Failed to import wallet:', error);
            this.notificationManager.showError('Failed to import wallet. Please check your private key.');
        }
    }

    getCurrentWallet(): WalletInfo | null {
        return this.currentWallet;
    }
    
    /**
     * Reset the current wallet state
     */
    resetWallet(): void {
        this.currentWallet = null;
    }

    async refreshBalance(): Promise<any> {
        if (!this.currentWallet) {
            throw new Error('No wallet available');
        }

        try {
            const balance = await this.currentWallet.wallet.getBalance();
            return balance;
        } catch (error) {
            console.error('Failed to refresh balance:', error);
            this.notificationManager.showError('Failed to refresh balance');
            throw error;
        }
    }

    async settle(): Promise<void> {
        if (!this.currentWallet) {
            this.notificationManager.showError('No wallet available');
            return;
        }

        try {
            this.notificationManager.showInfo('Settling wallet...');
            
            const settleResult = await this.currentWallet.wallet.settle();
            console.log('Settle result:', settleResult);
            
            if (settleResult) {
                this.notificationManager.showSuccess(`Settlement successful! TXID: ${settleResult}`);
            } else {
                this.notificationManager.showSuccess('Settlement completed');
            }
        } catch (error) {
            console.error('Settlement failed:', error);
            this.notificationManager.showError('Settlement failed');
        }
    }

    async sendTransaction(address: string, amount?: number): Promise<void> {
        if (!this.currentWallet) {
            this.notificationManager.showError('No wallet available');
            return;
        }

        if (!address.trim()) {
            this.notificationManager.showError('Please enter valid address');
            return;
        }

        try {
            this.notificationManager.showInfo('Sending transaction...');
            
            let sendAmount: number;
            if (amount === undefined) {
                // Use full balance if no amount specified
                const balanceInfo = await this.currentWallet.wallet.getBalance();
                sendAmount = balanceInfo.total;
                console.log('Using full balance:', sendAmount);
            } else {
                sendAmount = amount;
            }
            
            if (sendAmount <= 0) {
                this.notificationManager.showError('Insufficient balance');
                return;
            }
            
            const result = await this.currentWallet.wallet.sendBitcoin({
                address,
                amount: sendAmount
            });
            console.log('Send result:', result);
            
            this.notificationManager.showSuccess(`Transaction sent successfully!`);
        } catch (error) {
            console.error('Transaction failed:', error);
            this.notificationManager.showError('Transaction failed');
        }
    }
}
