import { VEscrow } from './escrow';
import { CSVMultisigTapscript, buildOffchainTx, RelativeTimelock, ArkAddress } from '@arkade-os/sdk';
import { hex } from '@scure/base';
import { EscrowContract, EscrowState, WalletInfo } from './types';
import { NotificationManager } from './notification-manager';
import { UserManager } from './user-manager';
import { ServerManager } from './server-manager';
import { WalletManager } from './wallet-manager';
import { CommunicationProvider } from './communication-provider';
import { Transaction } from '@scure/btc-signer';

export class ContractManager {
    private notificationManager: NotificationManager;
    private userManager: UserManager;
    private serverManager: ServerManager;
    private walletManager: WalletManager;
    private communicationProvider: CommunicationProvider;
    private contracts: Map<string, EscrowContract> = new Map();

    constructor(notificationManager: NotificationManager, 
        userManager: UserManager, 
        serverManager: ServerManager,
        walletManager: WalletManager,
        communicationProvider: CommunicationProvider) {
        this.notificationManager = notificationManager;
        this.userManager = userManager;
        this.serverManager = serverManager;
        this.walletManager = walletManager;
        this.communicationProvider = communicationProvider;
        this.initializeContracts();
    }

    private async initializeContracts(): Promise<void> {
        // Subscribe to contract updates from communication provider
        this.communicationProvider.subscribeToContracts((contracts) => {
            this.updateContractsFromProvider(contracts);
        });
        
        // Load initial contracts
        await this.loadContracts();
    }

    /**
     * Load contracts from communication provider
     */
    private async loadContracts(): Promise<void> {
        try {
            const contracts = await this.communicationProvider.getContracts();
            this.contracts.clear();
            contracts.forEach(contract => {
                this.contracts.set(contract.arkAddress, contract);
            });
        } catch (error) {
            console.error('Failed to load contracts from communication provider:', error);
        }
    }

    /**
     * Update local contracts map when communication provider notifies of changes
     */
    private updateContractsFromProvider(contracts: EscrowContract[]): void {
        this.contracts.clear();
        contracts.forEach(contract => {
            this.contracts.set(contract.arkAddress, contract);
        });
    }

    restoreScript(contract: EscrowContract): VEscrow.Script {
        return new VEscrow.Script({
            unilateralDelay: this.serverManager.getUnilateralDelay(),
            buyer: hex.decode(contract.buyer.pubkey),
            seller: hex.decode(contract.seller.pubkey),
            arbitrator: hex.decode(contract.arbitrator.pubkey),
            server: hex.decode(this.serverManager.getServerKey())
        });
    }

    async createEscrowContract(
        buyerId: string,
        sellerId: string,
        arbitratorId: string,
        description: string,
        currentWallet: WalletInfo | null,
        unilateralDelay: RelativeTimelock
    ): Promise<void> {
        if (!currentWallet) {
            this.notificationManager.showError('No wallet available');
            return;
        }

        if (!buyerId || !sellerId || !arbitratorId) {
            this.notificationManager.showError('Please select all parties');
            return;
        }

        // Check if all selected parties are different
        const parties = [buyerId, sellerId, arbitratorId];
        if (new Set(parties).size !== parties.length) {
            this.notificationManager.showError('All parties must be different users');
            return;
        }

        try {
            const buyer = this.userManager.getUserById(buyerId);
            const seller = this.userManager.getUserById(sellerId);
            const arbitrator = this.userManager.getUserById(arbitratorId);
            const server = this.serverManager.getServerKey();
            const addrPrefix = this.serverManager.getAddrPrefix();
            if (!buyer || !seller || !arbitrator) {
                this.notificationManager.showError('One or more selected users not found');
                return;
            }


            
           
            const contract: EscrowContract = {
                buyer,
                seller,
                arbitrator,
                description: description.trim(),
                timestamp: Date.now(), 
                arkAddress: ''
            };

            const escrowScript = this.restoreScript(contract);
            const arkAddress = escrowScript.address(addrPrefix, hex.decode(server));
            contract.arkAddress = arkAddress.encode();

            // Store contract locally and publish to communication provider
            this.contracts.set(contract.arkAddress, contract);
            await this.communicationProvider.publishContract(contract);

            this.notificationManager.showSuccess('Escrow contract created successfully!');
        } catch (error) {
            console.error('Failed to create contract:', error);
            this.notificationManager.showError('Failed to create contract');
        }
    }

    getContracts(): EscrowContract[] {
        return Array.from(this.contracts.values());
    }

    /**
     * Refresh contracts from communication provider
     */
    async refreshContracts(): Promise<void> {
        await this.loadContracts();
    }

    getContractsForUser(userPubkey: string): EscrowContract[] {
        const allContracts = this.getContracts();
        return allContracts.filter(contract => 
            contract.buyer.pubkey === userPubkey ||
            contract.seller.pubkey === userPubkey ||
            contract.arbitrator.pubkey === userPubkey
        );
    }

    /**
     * Get the current state of an escrow contract from the blockchain
     * @param contract The escrow contract
     * @returns The current escrow state
     */
    async getEscrowState(contract: EscrowContract): Promise<EscrowState> {

        const escrowScript = this.restoreScript(contract);
        const address = escrowScript.address(this.serverManager.getAddrPrefix(), hex.decode(this.serverManager.getServerKey()));
        if (!address) {
            return {
                status: 'created',
                balance: 0,
                vtxoExists: false
            };
        }

        try {
            const provider = this.serverManager.getIndexerProvider();
            if (!provider) {
                throw new Error('No provider available');
            }


            const script = hex.encode(address.pkScript);
            // Check if the escrow address has a balance (vtxo exists)
            const vtxos = await provider.getVtxos({
                scripts:[script],
                

            })
            const vtxoExists = vtxos.vtxos.length > 0;
            const vtxoSum = vtxos.vtxos.reduce((total, vtxo) => total +  (vtxo.spentBy ? 0 : vtxo.value), 0);
            const allVtxosSpent = vtxoExists && vtxos.vtxos.every(vtxo => vtxo.spentBy);
            
            let status: 'created' | 'funded' | 'executed';
            if (!vtxoExists) {
                // No VTXOs ever created
                status = 'created';
            } else if (allVtxosSpent) {
                // VTXOs exist but all are spent
                status = 'executed';
            } else {
                // VTXOs exist and at least one is unspent
                status = 'funded';
            }


            return {
                status,
                balance: vtxoSum,
                vtxoExists
            };
        } catch (error) {
            console.error('Failed to get escrow state:', error);
            return {
                status: 'created',
                balance: 0,
                vtxoExists: false
            };
        }
    }

    getAvailableActions(state: EscrowState, userRole: string | null): string[] {
        const actions: string[] = [];
        
        if (!userRole) return actions;
        
        if(state.status === 'created'){
            switch (userRole) {
                case 'seller':
                    actions.push('Fund');
                    break;
            }
            return actions;
        }

        
        switch (userRole) {
            case 'buyer':
                actions.push('Refund', 'Direct Settle');
                break;
            case 'seller':
                actions.push('Release', 'Direct Settle');
                break;
            case 'arbitrator':
                actions.push('Release', 'Refund');
                break;
        }
        
        return actions;
    }

    async executeContractAction(contract: EscrowContract, action: string, currentWallet: WalletInfo): Promise<void> {
        try {
            const escrowScript = this.restoreScript(contract);
            const address = escrowScript.address(this.serverManager.getAddrPrefix(), hex.decode(this.serverManager.getServerKey()));
            const script = hex.encode(address.pkScript);
            // Get VTXOs for the contract address to check if funds exist
            const indexerProvider = this.serverManager.getIndexerProvider();
            const vtxosResult = await indexerProvider.getVtxos({ scripts: [script] });
            
            if(action?.toLowerCase() === "fund"){
                if (vtxosResult.vtxos.length > 0) {
                    this.notificationManager.showError('Funds already exist in escrow contract');
                    return;
                } else {
                    // Send full balance to the escrow address
                    const escrowAddress = address.encode();
                    await this.walletManager.sendTransaction(escrowAddress);
                    return;
                }
            }
            if (vtxosResult.vtxos.length === 0) {
                this.notificationManager.showError('No funds found in escrow contract');
                return;
            }

            const vtxo = vtxosResult.vtxos[0];
            console.log('Found VTXO:', vtxo.txid, 'with amount:', vtxo.value);

            // Determine required signers based on action and current user role
            const requiredSigners = this.getRequiredSignersForAction(action, contract, currentWallet);
            
            if (requiredSigners.length === 0) {
                this.notificationManager.showError(`You are not authorized to perform ${action}`);
                return;
            }

            // Create the actual Ark transaction spending from contract VTXO
            const { arkTx, checkpoints } = await this.createEscrowTransaction(contract, action, vtxo);
            
            // Sign the transaction and checkpoints with the initiator's wallet
            console.log(`Initiator ${this.getUserNameByPubkey(currentWallet.pubkey, contract)} signing transaction and checkpoints...`);
            const signedArkTx = await currentWallet.identity.sign(arkTx);
            
            // Also sign the checkpoint transactions with the initiator's wallet
            const signedCheckpoints = await Promise.all(
                checkpoints.map(async (checkpoint) => {
                    const signedCheckpoint = await currentWallet.identity.sign(checkpoint, [0]);
                    return Array.from(signedCheckpoint.toPSBT());
                })
            );
            
            console.log('Initiator signatures added to transaction and checkpoints');
            
            // Create a pending transaction with the signed transaction data
            const pendingTransaction = {
                action,
                initiator: currentWallet.pubkey,
                timestamp: Date.now(),
                status: 'pending_cosign' as const,
                partialTx: {
                    vtxo: {
                        txid: vtxo.txid,
                        vout: vtxo.vout,
                        value: vtxo.value
                    },
                    arkTx: Array.from(signedArkTx.toPSBT()) as number[], // Store the signed transaction
                    checkpoints: signedCheckpoints as number[][], // Store the signed checkpoints
                    requiredSigners: requiredSigners.filter((pubkey: string) => pubkey !== currentWallet.pubkey),
                    initiatorSigned: true,
                    approvals: [currentWallet.pubkey], // Initiator automatically approves
                    rejections: []
                }
            };
            
            // Update the contract with the pending transaction
            this.updateContractPendingTransaction(address.encode(), pendingTransaction);
            
            const otherSigners = pendingTransaction.partialTx.requiredSigners.map((pubkey: string) => this.getUserNameByPubkey(pubkey, contract)).join(', ');
            this.notificationManager.showSuccess(`Partial transaction created for ${action}. ${otherSigners ? `Waiting for cosignature from: ${otherSigners}.` : 'Ready to execute!'}`);
        } catch (error: any) {
            console.error(`Failed to execute ${action}:`, error);
            this.notificationManager.showError(`Failed to create transaction for ${action}: ${error.message || 'Unknown error'}`);
        }
    }

    private getUserRole(contract: EscrowContract, pubkey: string): string | null {
        if (pubkey === contract.buyer.pubkey) return 'buyer';
        if (pubkey === contract.seller.pubkey) return 'seller';
        if (pubkey === contract.arbitrator.pubkey) return 'arbitrator';
        return null;
    }

    private getRequiredSignersForAction(action: string, contract: EscrowContract, currentWallet: WalletInfo): string[] {
        const currentUserRole = this.getUserRole(contract, currentWallet.pubkey);
        
        switch (action.toLowerCase()) {
            case 'fund':
                // Only buyer can fund
                return currentUserRole === 'buyer' ? [contract.buyer.pubkey] : [];
            case 'release':
                // Seller + Arbitrator can release
                return currentUserRole === 'seller' || currentUserRole === 'arbitrator' 
                    ? [contract.seller.pubkey, contract.arbitrator.pubkey] : [];
            case 'refund':
                // Buyer + Arbitrator can refund
                return currentUserRole === 'buyer' || currentUserRole === 'arbitrator'
                    ? [contract.buyer.pubkey, contract.arbitrator.pubkey] : [];
            case 'direct settle':
                // Buyer + Seller can direct settle
                return currentUserRole === 'buyer' || currentUserRole === 'seller'
                    ? [contract.buyer.pubkey, contract.seller.pubkey] : [];
            default:
                return [];
        }
    }

    private getUserNameByPubkey(pubkey: string, contract: EscrowContract): string {
        if (pubkey === contract.buyer.pubkey) return contract.buyer.name;
        if (pubkey === contract.seller.pubkey) return contract.seller.name;
        if (pubkey === contract.arbitrator.pubkey) return contract.arbitrator.name;
        return 'Unknown User';
    }

    private async signTransactionsForUser(contract: EscrowContract, currentWallet: WalletInfo): Promise<void> {
        if (!contract.pendingTransaction?.partialTx) {
            throw new Error('No pending transaction to sign');
        }

        const { partialTx } = contract.pendingTransaction;
        
        // Check if current wallet is authorized to sign for this transaction
        const authorizedWallet = await this.getWalletForSigner(currentWallet.pubkey, contract);
        if (!authorizedWallet) {
            throw new Error(`Wallet ${this.getUserNameByPubkey(currentWallet.pubkey, contract)} is not authorized to sign this transaction`);
        }

        
        
        try {
            console.log('Signing transactions for user:', this.getUserNameByPubkey(currentWallet.pubkey, contract));
            console.log('arkTx type:', typeof partialTx.arkTx, 'length:', partialTx.arkTx?.length);
            console.log('checkpoints count:', partialTx.checkpoints?.length);
            
            // Sign the Ark transaction
            // Convert array back to Uint8Array for Transaction.fromPSBT
            const arkTxData = Array.isArray(partialTx.arkTx) ? new Uint8Array(partialTx.arkTx) : 
                             partialTx.arkTx instanceof Uint8Array ? partialTx.arkTx : new Uint8Array(partialTx.arkTx);
            
            console.log('Before signing - arkTx data length:', arkTxData.length);
            let arkTx = Transaction.fromPSBT(arkTxData, { allowUnknown: true });
            console.log('Transaction loaded from PSBT, signing with:', this.getUserNameByPubkey(currentWallet.pubkey, contract));
            
            arkTx = await authorizedWallet.identity.sign(arkTx);
            const signedPSBT = arkTx.toPSBT();
            console.log('After signing - PSBT data length:', signedPSBT.length);
            
            partialTx.arkTx = Array.from(signedPSBT); // Convert back to array for storage
            
            // Sign all checkpoint transactions
            const signedCheckpoints = await Promise.all(
                partialTx.checkpoints.map(async (checkpointPSBT) => {
                    // Convert array back to Uint8Array for Transaction.fromPSBT
                    const checkpointData = Array.isArray(checkpointPSBT) ? new Uint8Array(checkpointPSBT) :
                                          checkpointPSBT instanceof Uint8Array ? checkpointPSBT : new Uint8Array(checkpointPSBT);
                    let checkpoint = Transaction.fromPSBT(checkpointData, { allowUnknown: true });
                    checkpoint = await authorizedWallet.identity.sign(checkpoint, [0]);
                    return Array.from(checkpoint.toPSBT()); // Convert back to array for storage
                })
            );
            
            partialTx.checkpoints = signedCheckpoints;
            
            console.log(`Successfully signed transactions for ${this.getUserNameByPubkey(currentWallet.pubkey, contract)}`);
            
        } catch (error: any) {
            console.error('Failed to sign transactions:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to sign transactions: ${error.message}`);
        }
    }

    private async getWalletForSigner(pubkey: string, contract: EscrowContract): Promise<WalletInfo | null> {
        // In a real implementation, we need access to all signers' wallets
        // For now, we can only sign with the current wallet if it matches the required signer
        const currentWallet = this.walletManager.getCurrentWallet();
        if (currentWallet && currentWallet.pubkey === pubkey) {
            return currentWallet;
        }
        
        // In a production system, you would need a way to access other signers' wallets
        // This could be through a secure multi-party signing service or stored signatures
        console.warn(`Cannot access wallet for signer ${this.getUserNameByPubkey(pubkey, contract)} (${pubkey})`);
        return null;
    }

    private getSpendingPathForAction(escrowScript: VEscrow.Script, action: string): any {
        switch (action.toLowerCase()) {
            case 'fund':
                return null; // Funding doesn't use a spending path
            case 'release':
                return escrowScript.release();
            case 'refund':
                return escrowScript.refund();
            case 'direct settle':
                return escrowScript.direct();
            default:
                return null;
        }
    }

    private async createEscrowTransaction(contract: EscrowContract, action: string, vtxo: any): Promise<{ arkTx: any, checkpoints: any[] }> {
        const escrowScript = this.restoreScript(contract);
        
        // Get the spending path for this action
        const spendingPath = this.getSpendingPathForAction(escrowScript, action);
        if (!spendingPath && action.toLowerCase() !== 'fund') {
            throw new Error(`Invalid action: ${action}`);
        }

        // Create server unroll script for checkpoint transactions
        const serverKey = this.serverManager.getServerKey();
        const unilateralDelay = this.serverManager.getUnilateralDelay();
        
        const serverUnrollScript = CSVMultisigTapscript.encode({
            pubkeys: [hex.decode(serverKey)],
            timelock: unilateralDelay
        });

        // Create input from the contract VTXO
        const input = {
            txid: vtxo.txid,
            vout: vtxo.vout,
            value: vtxo.value,
            script: escrowScript.pkScript,
            tapTree: escrowScript.encode(),
            tapLeafScript: spendingPath // Use the spending path directly, not .script property
        };

        // Determine outputs based on action
        const outputs = this.createOutputsForAction(action, contract, vtxo.value);

        console.log('Building offchain tx with input:', input.txid, 'outputs:', outputs.length);
        console.log('Input details:', {
            txid: input.txid,
            vout: input.vout,
            value: input.value,
            hasScript: !!input.script,
            hasTapTree: !!input.tapTree,
            hasTapLeafScript: !!input.tapLeafScript
        });
        console.log('Outputs:', outputs);
        console.log('ServerUnrollScript type:', typeof serverUnrollScript);

        try {
            // Build the offchain transaction
            const result = buildOffchainTx(
                [input],
                outputs,
                serverUnrollScript
            );
            
            console.log('buildOffchainTx result:', result);
            
            if (!result || typeof result !== 'object') {
                throw new Error('buildOffchainTx returned invalid result');
            }
            
            const { arkTx, checkpoints } = result;
            
            if (!arkTx || !checkpoints) {
                throw new Error('buildOffchainTx missing arkTx or checkpoints');
            }
            
            return { arkTx, checkpoints };
        } catch (error: any) {
            console.error('buildOffchainTx failed:', error);
            throw new Error(`Failed to build offchain transaction: ${error.message}`);
        }
    }

    private createOutputsForAction(action: string, contract: EscrowContract, amount: number): any[] {
        switch (action.toLowerCase()) {
            case 'release':
                // Send all funds to seller
                return [{
                    amount: BigInt(amount),
                    script: this.addressToScript(contract.seller.address)
                }];
            
            case 'refund':
                // Send all funds to buyer
                return [{
                    amount: BigInt(amount),
                    script: this.addressToScript(contract.buyer.address)
                }];
            
            case 'direct settle':
                // Split 50/50 between buyer and seller
                const halfAmount = Math.floor(amount / 2);
                return [
                    {
                        amount: BigInt(halfAmount),
                        script: this.addressToScript(contract.buyer.address)
                    },
                    {
                        amount: BigInt(amount - halfAmount), // Remaining amount to avoid rounding issues
                        script: this.addressToScript(contract.seller.address)
                    }
                ];
            
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    private addressToScript(address: string): Uint8Array {
        try {
            
            // Decode the Ark address to get the script
            const arkAddress = ArkAddress.decode(address);
            return arkAddress.pkScript;
        } catch (error) {
            console.error('Failed to convert address to script:', error);
            // Fallback: if it's already a hex string, try to decode it
            if (typeof address === 'string' && address.length % 2 === 0) {
                try {
                    return hex.decode(address);
                } catch (hexError) {
                    console.error('Failed to hex decode address:', hexError);
                }
            }
            throw new Error(`Cannot convert address to script: ${address}`);
        }
    }

    async approvePendingTransaction(contract: EscrowContract, currentWallet: WalletInfo): Promise<void> {
        if (!contract.pendingTransaction || !contract.pendingTransaction.partialTx) {
            this.notificationManager.showError('No pending transaction to approve');
            return;
        }

        const { partialTx } = contract.pendingTransaction;
        
        // Check if user is required to sign
        if (!partialTx.requiredSigners.includes(currentWallet.pubkey)) {
            this.notificationManager.showError('You are not required to sign this transaction');
            return;
        }

        // Check if user already approved
        if (partialTx.approvals.includes(currentWallet.pubkey)) {
            this.notificationManager.showError('You have already approved this transaction');
            return;
        }

        try {
            const actionName = contract.pendingTransaction.action;
            this.notificationManager.showInfo(`Signing ${actionName} transaction...`);
            
            // Sign the transactions with the current user's wallet
            await this.signTransactionsForUser(contract, currentWallet);
            
            // Add this user's approval
            partialTx.approvals.push(currentWallet.pubkey);
            
            // Check if all required signatures are collected
            const allRequiredSigners = [...partialTx.requiredSigners, contract.pendingTransaction.initiator];
            const allApproved = allRequiredSigners.every(pubkey => partialTx.approvals.includes(pubkey));
            
            console.log('Approval check:', {
                action: contract.pendingTransaction.action,
                requiredSigners: partialTx.requiredSigners.map(pk => `${this.getUserNameByPubkey(pk, contract)} (${pk.slice(0,8)}...)`),
                initiator: `${this.getUserNameByPubkey(contract.pendingTransaction.initiator, contract)} (${contract.pendingTransaction.initiator.slice(0,8)}...)`,
                allRequiredSigners: allRequiredSigners.map(pk => `${this.getUserNameByPubkey(pk, contract)} (${pk.slice(0,8)}...)`),
                currentApprovals: partialTx.approvals.map(pk => `${this.getUserNameByPubkey(pk, contract)} (${pk.slice(0,8)}...)`),
                currentUser: `${this.getUserNameByPubkey(currentWallet.pubkey, contract)} (${currentWallet.pubkey.slice(0,8)}...)`,
                allApproved
            });
            console.log('Contract roles:', {
                buyer: `${contract.buyer.name} (${contract.buyer.pubkey.slice(0,8)}...)`,
                seller: `${contract.seller.name} (${contract.seller.pubkey.slice(0,8)}...)`,
                arbitrator: `${contract.arbitrator.name} (${contract.arbitrator.pubkey.slice(0,8)}...)`
            });
            
            if (allApproved) {
                // All signatures collected - execute the transaction
                await this.executeMultiSigTransaction(contract);
            } else {
                // Still waiting for more signatures
                const remainingSigners = allRequiredSigners.filter(pubkey => !partialTx.approvals.includes(pubkey));
                const remainingNames = remainingSigners.map(pubkey => this.getUserNameByPubkey(pubkey, contract));
                this.notificationManager.showSuccess(`Transaction signed and approved. Waiting for signatures from: ${remainingNames.join(', ')}.`);
                
                // Update the pending transaction with new approval and signature
                await this.updateContractPendingTransaction(contract.arkAddress, contract.pendingTransaction);
            }
            
        } catch (error: any) {
            console.error('Failed to approve transaction:', error);
            const actionName = contract.pendingTransaction?.action || 'transaction';
            this.notificationManager.showError(`Failed to approve ${actionName}: ${error.message || 'Unknown error'}`);
        }
    }

    private async executeMultiSigTransaction(contract: EscrowContract): Promise<void> {
        if (!contract.pendingTransaction?.partialTx) {
            throw new Error('No pending transaction to execute');
        }

        const { partialTx } = contract.pendingTransaction;
        const actionName = contract.pendingTransaction.action;
        
        try {
            this.notificationManager.showInfo(`All signatures collected. Executing ${actionName}...`);
            
            // Get the Ark provider
            const arkProvider = this.serverManager.getProvider();
            if (!arkProvider) {
                throw new Error('Not connected to Ark server');
            }

            // Reconstruct transactions from PSBTs
            const { Transaction } = await import('@scure/btc-signer');
            const { base64 } = await import('@scure/base');
            
            // The Ark transaction has been signed by each required party when they approved
            // Now we can submit the fully-signed transaction
            const arkTxData = Array.isArray(partialTx.arkTx) ? new Uint8Array(partialTx.arkTx) : partialTx.arkTx;
            const arkTx = Transaction.fromPSBT(arkTxData, { allowUnknown: true });
            
            console.log('Submitting fully-signed transaction to Ark network...');
            
            // Phase 1: Submit the signed Ark transaction and get checkpoint transactions
            const checkpointData = partialTx.checkpoints.map(c => 
                Array.isArray(c) ? new Uint8Array(c) : c
            );
            const { arkTxid } = await arkProvider.submitTx(
                base64.encode(arkTx.toPSBT()),
                checkpointData.map(c => base64.encode(c))
            );
            
            console.log(`Successfully submitted ${actionName}! Transaction ID:`, arkTxid);
            this.notificationManager.showSuccess(`${actionName} transaction submitted! ID: ${arkTxid}`);
            
            // Phase 2: Use the checkpoint transactions signed by each required party
            // (each user signed their checkpoints when they approved)
            console.log('Using pre-signed checkpoints for finalization...');
            const finalCheckpoints = checkpointData.map(c => base64.encode(c));
            
            // Finalize the transaction
            await arkProvider.finalizeTx(arkTxid, finalCheckpoints);
            console.log(`Successfully finalized ${actionName}!`);
            this.notificationManager.showSuccess(`${actionName} transaction finalized successfully!`);
            
            // Clear the pending transaction
            contract.pendingTransaction = undefined;
            await this.updateContractPendingTransaction(contract.arkAddress, undefined);
            
        } catch (error: any) {
            console.error('Failed to execute multi-sig transaction:', error);
            this.notificationManager.showError(`Failed to execute ${actionName}: ${error.message || 'Unknown error'}`);
        }
    }

    async rejectPendingTransaction(contract: EscrowContract, currentWallet: WalletInfo): Promise<void> {
        if (!contract.pendingTransaction || !contract.pendingTransaction.partialTx) {
            this.notificationManager.showError('No pending transaction to reject');
            return;
        }

        const { partialTx } = contract.pendingTransaction;
        
        // Check if user is required to sign
        if (!partialTx.requiredSigners.includes(currentWallet.pubkey)) {
            this.notificationManager.showError('You are not authorized to reject this transaction');
            return;
        }

        // Add rejection
        if (!partialTx.rejections.includes(currentWallet.pubkey)) {
            partialTx.rejections.push(currentWallet.pubkey);
        }
        
        // Mark transaction as rejected
        contract.pendingTransaction.status = 'rejected';
        this.notificationManager.showSuccess(`Transaction rejected by ${this.getUserNameByPubkey(currentWallet.pubkey, contract)}`);
        
        // Clear the pending transaction after a delay
        setTimeout(() => {
            contract.pendingTransaction = undefined;
            this.updateContractPendingTransaction(contract.arkAddress, undefined);
            this.notificationManager.showInfo('Rejected transaction cleared');
        }, 3000);
        
        this.updateContractPendingTransaction(contract.arkAddress, contract.pendingTransaction);
    }

    private async updateContractPendingTransaction(arkAddress: string, pendingTransaction: EscrowContract['pendingTransaction']): Promise<void> {
        try {
            const contract = this.contracts.get(arkAddress);
            if (contract) {
                contract.pendingTransaction = pendingTransaction;
                this.contracts.set(arkAddress, contract);
                await this.communicationProvider.updateContract(contract);
                
                // Also notify about the pending transaction change
                if (pendingTransaction) {
                    await this.communicationProvider.notifyPendingTransaction(arkAddress, pendingTransaction);
                }
            }
        } catch (error) {
            console.error('Failed to update contract pending transaction:', error);
        }
    }
}
