import { User } from './types';
import { WalletManager } from './wallet-manager';
import { UserManager } from './user-manager';
import { ContractManager } from './contract-manager';
import { ServerManager } from './server-manager';

export class UIManager {
    private elements: any;
    private walletManager: WalletManager;
    private userManager: UserManager;
    private contractManager: ContractManager;
    private serverManager: ServerManager;

    constructor(
        elements: any,
        walletManager: WalletManager,
        userManager: UserManager,
        contractManager: ContractManager,
        serverManager: ServerManager
    ) {
        this.elements = elements;
        this.walletManager = walletManager;
        this.userManager = userManager;
        this.contractManager = contractManager;
        this.serverManager = serverManager;
    }

    hideMainUI(): void {
        this.elements.walletInfo.style.display = 'none';
        // Hide wallet-dependent sections
        this.hideWalletDependentSections();
    }

    showMainUI(): void {
        this.elements.walletInfo.style.display = 'block';
        // Show wallet-dependent sections only if wallet is loaded
        if (this.walletManager.getCurrentWallet()) {
            this.showWalletDependentSections();
        } else {
            this.hideWalletDependentSections();
        }
    }
    
    /**
     * Hide UI sections that depend on having a wallet loaded
     */
    hideWalletDependentSections(): void {
        // Hide transactions section
        const transactionsSection = this.findSectionByHeadingText('Transactions');
        if (transactionsSection) transactionsSection.style.display = 'none';
        
        // Hide escrow contracts section
        const escrowSection = this.findSectionByHeadingText('Escrow Contracts');
        if (escrowSection) escrowSection.style.display = 'none';
        
        // Hide connected users section
        this.elements.usersList.parentElement.style.display = 'none';
    }
    
    /**
     * Show UI sections that depend on having a wallet loaded
     */
    showWalletDependentSections(): void {
        // Show transactions section
        const transactionsSection = this.findSectionByHeadingText('Transactions');
        if (transactionsSection) transactionsSection.style.display = 'block';
        
        // Show escrow contracts section
        const escrowSection = this.findSectionByHeadingText('Escrow Contracts');
        if (escrowSection) escrowSection.style.display = 'block';
        
        // Show connected users section
        this.elements.usersList.parentElement.style.display = 'block';
    }
    
    /**
     * Helper method to find a section by its heading text
     * @param headingText The text to search for in h2 elements
     * @returns The section element or null if not found
     */
    private findSectionByHeadingText(headingText: string): HTMLElement | null {
        // Get all h2 elements
        const headings = document.querySelectorAll('section h2');
        
        // Find the one containing the specified text
        for (const heading of headings) {
            if (heading.textContent?.includes(headingText)) {
                // Return the parent section
                return heading.closest('section');
            }
        }
        
        return null;
    }

    /**
     * Updates UI sections that depend on wallet state
     */
    updateWalletDependentUI(): void {
        const wallet = this.walletManager.getCurrentWallet();
        
        if (wallet) {
            this.showWalletDependentSections();
        } else {
            this.hideWalletDependentSections();
        }
    }
    
    showImportForm(): void {
        this.elements.importForm.style.display = 'block';
        this.elements.privateKey.focus();
    }

    hideImportForm(): void {
        this.elements.importForm.style.display = 'none';
        this.elements.privateKey.value = '';
    }

    showSendForm(): void {
        this.elements.sendForm.style.display = 'block';
        this.elements.sendAddress.focus();
    }

    hideSendForm(): void {
        this.elements.sendForm.style.display = 'none';
        this.elements.sendAddress.value = '';
        this.elements.sendAmount.value = '';
    }

    updateWalletUI(): void {
        const wallet = this.walletManager.getCurrentWallet();
        
        if (wallet) {
            // Hide wallet creation/import buttons
            this.elements.createWallet.style.display = 'none';
            this.elements.importWallet.style.display = 'none';
            
            // Show wallet info
            this.elements.walletAddress.textContent = wallet.arkAddress;
            this.elements.walletPubkey.textContent = wallet.pubkey;
            
            // Set private key but initially hide it with asterisks
            this.elements.walletPrivkey.textContent = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
            this.elements.walletPrivkey.dataset.privkey = wallet.privateKey;
            this.elements.walletPrivkey.dataset.hidden = 'true';
            
            // Remove hidden class and ensure display is set to block
            this.elements.walletInfo.classList.remove('hidden');
            this.elements.walletInfo.style.display = 'block';
            
            // Auto-register user when wallet is loaded
            this.userManager.autoRegisterUser(wallet);
            
            // Update UI
            this.updateUsersUI();
            this.updateContractsUI();
            this.updateBalanceUI(); // Ensure balance is displayed
        } else {
            // Show wallet creation/import buttons
            this.elements.createWallet.style.display = 'inline-block';
            this.elements.importWallet.style.display = 'inline-block';
            
            // Hide wallet info
            this.elements.walletInfo.style.display = 'none';
        }
    }

    async updateBalanceUI(balance?: any): Promise<void> {
        if (!balance) {
            try {
                balance = await this.walletManager.refreshBalance();
            } catch (error) {
                console.error('Error fetching balance:', error);
                return;
            }
        }
        
        if (balance) {
            // Use available balance instead of confirmed
            const balanceAmount = balance.available || balance.settled || balance.preconfirmed || 0;
            
            // Check for boarding coins
            let boardingAmount = 0;
            if (balance.boarding && balance.boarding.amount) {
                boardingAmount = balance.boarding.amount;
            } else if (balance.boarding && balance.boarding.value) {
                boardingAmount = balance.boarding.value;
            }
            
            // Display total balance (available + boarding)
            const totalBalance = balanceAmount + boardingAmount;
            this.elements.walletBalance.textContent = `${totalBalance} sats`;
            
            // Update coins display - include boarding coins if they exist
            const allCoins = [];
            if (balance.coins && balance.coins.length > 0) {
                allCoins.push(...balance.coins);
            }
            
            // Add boarding coins if they exist
            if (balance.boarding) {
                if (Array.isArray(balance.boarding)) {
                    allCoins.push(...balance.boarding);
                } else if (typeof balance.boarding === 'object') {
                    // Add boarding as a single coin
                    allCoins.push({
                        ...balance.boarding,
                        value: boardingAmount,
                        isBoarding: true
                    });
                }
            }
            
            this.updateCoinsDisplay(allCoins);
        } else {
            this.elements.walletBalance.textContent = 'Unknown';
            this.elements.walletCoins.textContent = 'No coins available';
        }
    }
    
    /**
     * Display the wallet's coins
     */
    updateCoinsDisplay(coins: any[]): void {
        // // Check if we have coins in the balance object
        // if (!coins || coins.length === 0) {
        //     const wallet = this.walletManager.getCurrentWallet();
        //     if (wallet) {
        //         // Check if there's a balance but no coins
        //         const balanceText = this.elements.walletBalance.textContent;
        //         const hasBalance = balanceText && !balanceText.includes('0 sats') && !balanceText.includes('Loading');
                
        //         if (hasBalance) {
        //             this.elements.walletCoins.textContent = 'Balance available, coins details pending';
        //             return;
        //         }
                
        //         this.elements.walletCoins.textContent = 'Loading coins...';
        //         setTimeout(() => this.refreshCoinsDisplay(), 500);
        //         return;
        //     }
            
        //     this.elements.walletCoins.textContent = 'No coins available';
        //     return;
        // }
        
        // // Clear previous content
        // this.elements.walletCoins.innerHTML = '';
        
        // // Create a list of coins
        // const coinsList = document.createElement('ul');
        // coinsList.className = 'coins-list';
        
        // coins.forEach(coin => {
        //     const coinItem = document.createElement('li');
        //     coinItem.className = 'coin-item';
            
        //     // Format coin details
        //     const value = coin.value || coin.amount || 0;
        //     const outpoint = coin.outpoint || coin.txid || 'Unknown';
        //     const truncatedOutpoint = outpoint.length > 20 ? 
        //         `${outpoint.substring(0, 10)}...${outpoint.substring(outpoint.length - 10)}` : 
        //         outpoint;
            
        //     // Add a badge for boarding coins
        //     const boardingBadge = coin.isBoarding ? 
        //         '<span class="coin-badge boarding">Boarding</span>' : '';
            
        //     coinItem.innerHTML = `
        //         <span class="coin-value">${value} sats</span>
        //         <span class="coin-outpoint" title="${outpoint}">${truncatedOutpoint}</span>
        //         ${boardingBadge}
        //     `;
            
        //     coinsList.appendChild(coinItem);
        // });
        
        // this.elements.walletCoins.appendChild(coinsList);
    }
    
    /**
     * Refresh the coins display by fetching updated balance
     */
    async refreshCoinsDisplay(): Promise<void> {
        const wallet = this.walletManager.getCurrentWallet();
        if (!wallet) {
            console.log('refreshCoinsDisplay: No wallet available');
            return;
        }
        
        try {
            console.log('refreshCoinsDisplay: Fetching balance...');
            const balance = await this.walletManager.refreshBalance();
            console.log('refreshCoinsDisplay: Balance received:', balance);
            
            if (balance && balance.coins && balance.coins.length > 0) {
                console.log('refreshCoinsDisplay: Coins found:', balance.coins);
                this.updateCoinsDisplay(balance.coins);
            } else {
                console.log('refreshCoinsDisplay: No coins in balance object');
                this.elements.walletCoins.textContent = 'No coins available';
            }
        } catch (error) {
            console.error('Error refreshing coins:', error);
            this.elements.walletCoins.textContent = 'Error loading coins';
        }
    }
    


    updateUsersUI(): void {
        // Force refresh users from localStorage first
        this.userManager.refreshUsers();
        
        const users = this.userManager.getUsers();
        const currentWallet = this.walletManager.getCurrentWallet();
        
        this.elements.usersList.innerHTML = '';
        
        if (users.length === 0) {
            this.elements.usersList.innerHTML = '<p class="no-users">No users connected</p>';
            this.updateContractSelects([]);
            return;
        }
        
        users.forEach((user: User) => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            const isCurrentUser = currentWallet && user.pubkey === currentWallet.pubkey;
            if (isCurrentUser) {
                userDiv.classList.add('current-user');
            }
            
            userDiv.innerHTML = `
                <div class="user-info">
                    <div class="user-name">${user.name} ${isCurrentUser ? '(You)' : ''}</div>
                    <div class="user-details">
                        <span class="user-pubkey">${user.pubkey.slice(0, 16)}...</span>
                        <span class="user-address">${user.address.slice(0, 16)}...</span>
                    </div>
                </div>
            `;
            
            this.elements.usersList.appendChild(userDiv);
        });
        
        this.updateContractSelects(users);
        
        // Show a toast notification when users are refreshed
        if (users.length > 0) {
            this.showToast(`Found ${users.length} connected users`);
        }
    }

    updateContractSelects(users: User[]): void {
        const selects = [this.elements.buyerSelect, this.elements.sellerSelect, this.elements.arbitratorSelect];
        
        selects.forEach(select => {
            // Store the currently selected value before updating
            const currentValue = select.value;
            
            select.innerHTML = '<option value="">Select user...</option>';
            
            users.forEach((user: User) => {
                const option = document.createElement('option');
                option.value = user.pubkey;
                option.textContent = user.name;
                select.appendChild(option);
            });
            
            // Restore the previously selected value if it still exists in the options
            if (currentValue) {
                // Try to set the value back - if the option exists, this will work
                select.value = currentValue;
                
                // If the value wasn't actually set (option doesn't exist), it will revert to empty
                // No need to explicitly check if the option exists
            }
        });
    }

    private getUserNameByPubkey(pubkey: string): string {
        const users = this.userManager.getUsers();
        const user = users.find(u => u.pubkey === pubkey);
        return user ? user.name : 'Unknown User';
    }

    async updateContractsUI(): Promise<void> {
        const currentWallet = this.walletManager.getCurrentWallet();
        
        if (!currentWallet) {
            this.elements.contractsList.innerHTML = '<p class="no-contracts">Please create or import a wallet to view contracts</p>';
            return;
        }
        
        // Get only contracts where current user is involved
        const contracts = this.contractManager.getContractsForUser(currentWallet.pubkey);
        
        this.elements.contractsList.innerHTML = '';
        
        if (contracts.length === 0) {
            this.elements.contractsList.innerHTML = '<p class="no-contracts">No contracts found where you are involved</p>';
            return;
        }
        
        for (const [index, contract] of contracts.entries()) {
            const contractDiv = document.createElement('div');
            contractDiv.className = 'contract-item';
            
            const userRole = this.userManager.getCurrentUserRole(contract, currentWallet);
            const state = await this.contractManager.getEscrowState(contract);
            const availableActions = this.contractManager.getAvailableActions(state, userRole);
            
            const actionsHtml = availableActions.length > 0 
                ? availableActions.map(action => 
                    `<button class="action-btn" onclick="window.arkApp.executeContractAction(${index}, '${action}')">${action}</button>`
                ).join(' ')
                : '<p class="no-actions">No actions available</p>';
            
            // Generate pending transaction UI
            let pendingTxHtml = '';
            if (contract.pendingTransaction && contract.pendingTransaction.partialTx) {
                const { pendingTransaction } = contract;
                const partialTx = pendingTransaction.partialTx;
                if (!partialTx) return; // Additional safety check
                
                const initiatorName = this.getUserNameByPubkey(pendingTransaction.initiator);
                const currentWallet = this.walletManager.getCurrentWallet();
                
                // Check if current user needs to approve/reject
                const needsApproval = currentWallet && 
                    partialTx.requiredSigners.includes(currentWallet.pubkey) && 
                    !partialTx.approvals.includes(currentWallet.pubkey) && 
                    !partialTx.rejections.includes(currentWallet.pubkey) &&
                    pendingTransaction.status === 'pending_cosign';
                
                const approvalCount = partialTx.approvals.length;
                const totalRequired = partialTx.requiredSigners.length + 1; // +1 for initiator
                
                pendingTxHtml = `
                    <div class="pending-tx ${pendingTransaction.status}">
                        <p><strong>Pending ${pendingTransaction.action}</strong> (initiated by ${initiatorName})</p>
                        <p>Approvals: ${approvalCount}/${totalRequired}</p>
                        ${needsApproval ? `
                            <div class="pending-actions">
                                <button class="btn btn-success" onclick="window.arkApp.approvePendingTransaction(${index})">✓ Approve</button>
                                <button class="btn btn-danger" onclick="window.arkApp.rejectPendingTransaction(${index})">✗ Reject</button>
                            </div>
                        ` : ''}
                        ${pendingTransaction.status === 'approved' ? '<p class="status-approved">✓ Approved - Executing...</p>' : ''}
                        ${pendingTransaction.status === 'rejected' ? '<p class="status-rejected">✗ Rejected</p>' : ''}
                    </div>
                `;
            }
            
            contractDiv.innerHTML = `
                <div class="contract-header">
                    <h4>Contract #${index + 1}</h4>
                    <span class="contract-status ${state.status}">${state.status}</span>
                </div>
                <div class="contract-details">
                    <p><strong>Description:</strong> ${contract.description}</p>
                    <p><strong>Ark Address:</strong> <code>${contract.arkAddress || 'Not available'}</code></p>
                    ${(state.balance && state.balance > 0) ? `<p><strong>Balance:</strong> ${state.balance} sats</p>` : ''}
                    <p><strong>Buyer:</strong> ${contract.buyer.name}</p>
                    <p><strong>Seller:</strong> ${contract.seller.name}</p>
                    <p><strong>Arbitrator:</strong> ${contract.arbitrator.name}</p>
                    ${userRole ? `<p><strong>Your Role:</strong> ${userRole}</p>` : ''}
                    ${pendingTxHtml}
                </div>
                <div class="contract-actions">
                    ${actionsHtml}
                </div>
            `;
            
            this.elements.contractsList.appendChild(contractDiv);
        }
    }

    clearContractForm(): void {
        this.elements.buyerSelect.value = '';
        this.elements.sellerSelect.value = '';
        this.elements.arbitratorSelect.value = '';
        this.elements.contractDescription.value = '';
    }

    /**
     * Updates the server configuration UI based on connection status
     * @param isConnected Whether the server is connected
     */
    updateServerUI(isConnected: boolean): void {
        const statusElement = document.getElementById('serverStatus') as HTMLDivElement;
        const serverUrlInput = document.getElementById('arkServerUrl') as HTMLInputElement;
        const connectButton = document.getElementById('connectServer') as HTMLButtonElement;
        
        if (isConnected) {
            // Get network information from server manager
            const networkInfo = this.serverManager.getNetworkInfo() || 'unknown';
            
            // Update status with badges
            statusElement.innerHTML = `
                <span class="badge badge-success">Connected</span>
                <span class="badge badge-info">${networkInfo}</span>
            `;
            
            // Disable input field
            serverUrlInput.disabled = true;
            
            // Update button text and style
            connectButton.textContent = 'Disconnect';
            connectButton.classList.remove('btn-primary');
            connectButton.classList.add('btn-secondary');
        } else {
            // Clear status text
            statusElement.innerHTML = '';
            
            // Enable input field
            serverUrlInput.disabled = false;
            
            // Update button text and style
            connectButton.textContent = 'Connect';
            connectButton.classList.remove('btn-secondary');
            connectButton.classList.add('btn-primary');
        }
    }

    async copyAddress(): Promise<void> {
        const wallet = this.walletManager.getCurrentWallet();
        if (wallet) {
            await navigator.clipboard.writeText(wallet.arkAddress);
        }
    }
    
    /**
     * Copy the private key to clipboard
     */
    copyPrivkey(): void {
        const wallet = this.walletManager.getCurrentWallet();
        if (wallet && wallet.privateKey) {
            // If the private key is hidden, show it first
            if (this.elements.walletPrivkey.dataset.hidden === 'true') {
                this.togglePrivkeyVisibility();
            }
            
            navigator.clipboard.writeText(wallet.privateKey)
                .then(() => {
                    this.showToast('Private key copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy private key:', err);
                    this.showToast('Failed to copy private key', 'error');
                });
        }
    }
    
    /**
     * Toggle the visibility of the private key
     */
    togglePrivkeyVisibility(): void {
        const privkeyElement = this.elements.walletPrivkey;
        const wallet = this.walletManager.getCurrentWallet();
        
        if (!wallet || !wallet.privateKey) return;
        
        if (privkeyElement.dataset.hidden === 'true') {
            // Show the private key
            privkeyElement.textContent = wallet.privateKey;
            privkeyElement.dataset.hidden = 'false';
            this.elements.hidePrivkey.textContent = 'Hide';
        } else {
            // Hide the private key
            privkeyElement.textContent = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
            privkeyElement.dataset.hidden = 'true';
            this.elements.hidePrivkey.textContent = 'Show';
        }
    }
    
    /**
     * Show a toast notification
     * @param message Message to display
     * @param type Type of toast (success, error, warning, info)
     */
    showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to document
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}
