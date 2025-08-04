
import { SingleKey, Wallet } from '@arkade-os/sdk';

export interface User {
    name: string;
    pubkey: string;
    address: string;
    timestamp: number;
}

export interface EscrowContract {
    arkAddress: string;
    buyer: User;
    seller: User;
    arbitrator: User;
    description: string;
    timestamp: number;
    pendingTransaction?: {
        action: string;
        initiator: string;
        timestamp: number;
        status: 'pending_cosign' | 'approved' | 'rejected';
        partialTx?: {
            vtxo: {
                txid: string;
                vout: number;
                value: number;
            };
            arkTx: number[] | Uint8Array; // The Ark transaction as PSBT (array for storage, Uint8Array for processing)
            checkpoints: (number[] | Uint8Array)[]; // Checkpoint transactions as PSBTs (arrays for storage, Uint8Arrays for processing)
            requiredSigners: string[];
            initiatorSigned: boolean;
            approvals: string[]; // List of pubkeys who have approved
            rejections: string[]; // List of pubkeys who have rejected
        };
    };
}

export interface EscrowState {
    status: 'created' | 'funded' | 'executed';
    balance?: number;
    vtxoExists: boolean;
}

export interface WalletInfo {
    wallet: Wallet;
    identity: SingleKey;
    arkAddress: string;
    boardingAddress: string;
    pubkey: string;
    privateKey: string;
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type StatusType = 'success' | 'error' | 'info';
