# Ark Escrow Application - Complete Technical Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Multi-Signature Workflow](#multi-signature-workflow)
4. [File Structure & Responsibilities](#file-structure--responsibilities)
5. [Blockchain Integration](#blockchain-integration)
6. [Data Flow & State Management](#data-flow--state-management)
7. [User Interface](#user-interface)
8. [Development Guide](#development-guide)
9. [Security & Production](#security--production)
10. [Troubleshooting](#troubleshooting)

## 🎯 Overview

The Ark Escrow Application is a production-ready TypeScript web application demonstrating real multi-signature escrow contracts using the Ark blockchain SDK. It provides complete functionality for creating, managing, and executing three-party escrow contracts with cryptographic security.

### Key Features
- **Real Multi-Signature Security**: Cryptographic signatures from all required parties
- **Production Blockchain Integration**: Actual Ark network transactions and VTXOs
- **Three-Party Escrow Contracts**: Buyer, seller, and arbitrator roles
- **Cross-Tab Synchronization**: Real-time updates across browser instances
- **PSBT Transaction Handling**: Proper Partially Signed Bitcoin Transaction management
- **User-Friendly Interface**: Persistent naming (Alice/Bob/Carol) and intuitive UI
- **Comprehensive Error Handling**: Robust error recovery and user feedback

## 🏗️ Architecture

The application follows a modular, production-ready architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ NotificationMgr │    │   ServerManager │    │   UserManager   │
│                 │    │                 │    │                 │
│ • Toast alerts  │    │ • Ark providers │    │ • User discovery│
│ • Error display │    │ • Network comm  │    │ • Friendly names│
│ • Success msgs  │    │ • Server config │    │ • Cross-tab sync│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  ArkEscrowApp   │
                    │  (Orchestrator) │
                    │                 │
                    │ • Event routing │
                    │ • State coord   │
                    │ • UI management │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ WalletManager   │    │ ContractManager │    │   UIManager     │
│                 │    │                 │    │                 │
│ • Wallet ops    │    │ • Escrow logic  │    │ • DOM updates   │
│ • Balance mgmt  │    │ • Multi-sig tx  │    │ • Form handling │
│ • Private keys  │    │ • PSBT handling │    │ • State display │
│ • Boarding coins│    │ • Blockchain tx │    │ • Responsive UI │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Design Principles
- **Production-Ready**: Real blockchain integration, not simulations
- **Type Safety**: Comprehensive TypeScript coverage with strict mode
- **Cryptographic Security**: Real multi-signature transaction signing
- **Error Resilience**: Robust error handling and recovery mechanisms
- **Cross-Platform**: Works across browser tabs and devices
- **Maintainable**: Clean separation of concerns and modular design

## 🔐 Multi-Signature Workflow

### Transaction Creation & Signing Process

The application implements a real multi-signature workflow where each required party cryptographically signs the transaction:

```
1. INITIATION PHASE
   Carol (Buyer) → Create Refund Transaction
   ├── buildOffchainTx() creates Ark transaction + checkpoints
   ├── Carol signs both Ark tx and checkpoints with her private key
   └── Store signed PSBT data in localStorage

2. CO-SIGNATURE PHASE  
   Alice (Arbitrator) → Approve Pending Transaction
   ├── Load PSBT data from localStorage
   ├── Alice signs both Ark tx and checkpoints with her private key
   └── Check if all required signatures collected

3. EXECUTION PHASE
   System → Submit Fully-Signed Transaction
   ├── Submit signed Ark transaction to network
   ├── Receive transaction ID from Ark provider
   ├── Finalize with signed checkpoint transactions
   └── Confirm execution on blockchain
```

### Key Security Features

1. **Real Cryptographic Signatures**: Each party signs with their private key
2. **Incremental Signature Collection**: Signatures accumulated as users approve
3. **PSBT Serialization**: Proper handling for localStorage persistence
4. **Blockchain Verification**: Ark network validates all signatures
5. **Two-Phase Execution**: Transaction submission + checkpoint finalization

### Action Authorization Matrix

| Action | Buyer | Seller | Arbitrator | Required Signatures |
|--------|-------|--------|------------|--------------------|
| Fund | ✅ | ❌ | ❌ | Buyer only |
| Release | ❌ | ✅ | ✅ | Seller + Arbitrator |
| Refund | ✅ | ❌ | ✅ | Buyer + Arbitrator |
| Direct Settle | ✅ | ✅ | ❌ | Buyer + Seller |

### PSBT Data Flow

**Storage Format (localStorage)**:
```typescript
partialTx: {
    arkTx: number[], // Serialized PSBT as number array
    checkpoints: number[][], // Serialized checkpoint PSBTs
    requiredSigners: string[], // Pubkeys of required co-signers
    approvals: string[], // Pubkeys of users who have signed
    // ... other metadata
}
```

**Processing Format (Signing)**:
```typescript
// Convert to Uint8Array for Transaction.fromPSBT()
const arkTxData = new Uint8Array(partialTx.arkTx);
let arkTx = Transaction.fromPSBT(arkTxData, { allowUnknown: true });
arkTx = await wallet.identity.sign(arkTx);
// Convert back to number[] for storage
partialTx.arkTx = Array.from(arkTx.toPSBT());
```

## 📁 File Structure & Responsibilities

### Core Application Files

#### `/src/main.ts` (8 lines)
**Purpose**: Application entry point
- Initializes the main application class
- Sets up DOM ready event listener
- Minimal bootstrap code

```typescript
import { ArkEscrowApp } from './app.ts';

document.addEventListener('DOMContentLoaded', async () => {
    const app = new ArkEscrowApp();
    await app.initialize();
});
```

#### `/src/app.ts` (264 lines)
**Purpose**: Main orchestration class
**Responsibilities**:
- Initializes all manager classes
- Sets up event listeners for DOM elements
- Coordinates between different managers
- Handles application lifecycle events
- Manages cross-tab synchronization

**Key Methods**:
- `initializeElements()`: Maps DOM elements to properties
- `initializeManagers()`: Creates and configures all manager instances
- `setupEventListeners()`: Binds UI events to handler methods
- `setupCrossTabSync()`: Enables multi-tab user synchronization
- `initialize()`: Main initialization routine

#### `/src/types.ts` (34 lines)
**Purpose**: Centralized type definitions
**Exports**:
- `User`: User profile interface
- `EscrowContract`: Contract data structure
- `WalletInfo`: Wallet information container
- `NotificationType`: Notification type enum
- `StatusType`: Status message type enum

### Manager Classes

#### `/src/notification-manager.ts` (27 lines)
**Purpose**: UI notifications and status updates
**Responsibilities**:
- Display temporary notifications (success, error, warning, info)
- Update status elements with styled messages
- Auto-dismiss notifications after 5 seconds

**Key Methods**:
- `show(message, type)`: Display notification
- `updateStatus(element, message, type)`: Update status element

#### `/src/server-manager.ts` (64 lines)
**Purpose**: Ark server connection management
**Responsibilities**:
- Connect to Ark servers via REST API
- Validate server connections
- Store server URLs in localStorage
- Provide RestArkProvider instances

**Key Methods**:
- `connectToServer(url?)`: Establish server connection
- `getProvider()`: Get current provider instance
- `isServerConnected()`: Check connection status
- `getSavedServerUrl()`: Retrieve saved server URL

#### `/src/wallet-manager.ts` (160 lines)
**Purpose**: Wallet operations and management
**Responsibilities**:
- Create new wallets with random private keys
- Import wallets from private key hex
- Manage wallet balance and transactions
- Handle settlement operations
- Secure private key handling

**Key Methods**:
- `generateWallet()`: Create new wallet
- `createWallet()`: Create and store wallet
- `importWallet(privateKey)`: Import existing wallet
- `refreshBalance()`: Update wallet balance
- `settle()`: Perform wallet settlement
- `sendTransaction(address, amount)`: Send Bitcoin transaction

#### `/src/user-manager.ts` (66 lines)
**Purpose**: User registration and discovery
**Responsibilities**:
- Auto-register users when wallets are created
- Manage user discovery via localStorage
- Handle user cleanup on tab close
- Determine user roles in contracts

**Key Methods**:
- `autoRegisterUser(wallet)`: Register user automatically
- `getUsers()`: Retrieve all registered users
- `unregisterUser(wallet)`: Remove user on cleanup
- `getCurrentUserRole(contract, wallet)`: Determine user's role

#### `/src/contract-manager.ts` (125 lines)
**Purpose**: Escrow contract creation and management
**Responsibilities**:
- Create 3-party escrow contracts
- Validate contract parameters
- Integrate with VEscrow script system
- Execute contract actions
- Store contracts in localStorage

**Key Methods**:
- `createEscrowContract(...)`: Create new contract
- `getContracts()`: Retrieve all contracts
- `getAvailableActions(contract, role)`: Get role-based actions
- `executeContractAction(address, action)`: Execute contract action

#### `/src/ui-manager.ts` (209 lines)
**Purpose**: DOM manipulation and UI state management
**Responsibilities**:
- Update all UI elements based on state changes
- Handle form visibility and validation
- Render user lists and contract displays
- Manage UI interactions and feedback

**Key Methods**:
- `updateWalletUI()`: Update wallet information display
- `updateUsersUI()`: Refresh user list
- `updateContractsUI()`: Refresh contract list
- `showMainUI()` / `hideMainUI()`: Control main UI visibility
- Form management methods for various UI sections

### Supporting Files

#### `/src/escrow.ts` (8258 bytes)
**Purpose**: VEscrow class implementation
**Responsibilities**:
- Define escrow script logic
- Handle multi-signature operations
- Implement timelock mechanisms
- Provide spending path methods

#### `/src/index.html` (6434 bytes)
**Purpose**: Main HTML template
**Structure**:
- Server configuration section
- Wallet management interface
- User discovery panel
- Contract creation form
- Transaction interface
- Notification area

#### `/src/styles.css` (7151 bytes)
**Purpose**: Application styling
**Features**:
- Responsive design
- Modern gradient backgrounds
- Card-based layout
- Form styling
- Notification styles
- Mobile-friendly interface

### Configuration Files

#### `/package.json`
**Dependencies**:
- `@arkade-os/sdk`: Ark protocol integration
- `@scure/base`: Cryptographic utilities
- `@scure/btc-signer`: Bitcoin transaction signing

**Scripts**:
- `dev`: Development server
- `build`: Production build
- `serve`: Preview build
- `type-check`: TypeScript validation

#### `/vite.config.ts`
**Purpose**: Build configuration
- TypeScript compilation
- Static asset handling
- Development server setup

## ⚙️ Core Functionality

### 1. Server Connection
- Users enter Ark server URL
- Application validates connection
- Server URL saved to localStorage
- Provider instance created for API calls

### 2. Wallet Management
- **Create Wallet**: Generate random 32-byte private key
- **Import Wallet**: Import from hex private key
- **Address Generation**: Ark address and boarding address
- **Balance Tracking**: Available, settled, and boarding balances
- **Session-Only Storage**: No persistent private key storage

### 3. User Discovery
- **Auto-Registration**: Users registered when wallet created
- **Cross-Tab Sync**: Users visible across browser tabs
- **Real-Time Updates**: 5-second refresh interval
- **Cleanup**: Users removed when tabs close

### 4. Escrow Contracts
- **3-Party Structure**: Buyer, seller, arbitrator
- **VEscrow Integration**: Uses VEscrow.Script class
- **Role-Based Actions**: Different actions per role
- **Contract Storage**: Stored in localStorage
- **Action Execution**: Simulated contract actions

### 5. Transaction Management
- **Send Transactions**: Send to any Bitcoin address
- **Settlement**: Settle VTXOs and UTXOs
- **Balance Updates**: Real-time balance refresh
- **Error Handling**: Comprehensive error messages

## 🖥️ User Interface

### Layout Structure
```
┌─────────────────────────────────────────┐
│           Server Configuration          │
├─────────────────────────────────────────┤
│            Wallet Management            │
├─────────────────────────────────────────┤
│             User Discovery              │
├─────────────────────────────────────────┤
│           Contract Creation             │
├─────────────────────────────────────────┤
│            Active Contracts             │
├─────────────────────────────────────────┤
│            Notifications               │
└─────────────────────────────────────────┘
```

### UI States
1. **Initial State**: Only server configuration visible
2. **Connected State**: All sections visible after server connection
3. **Wallet Loaded**: Transaction buttons enabled
4. **Form States**: Various forms show/hide based on actions

### Responsive Design
- Mobile-first approach
- Flexible card layout
- Touch-friendly buttons
- Readable typography

## 🔄 Data Flow

### Application Initialization
1. DOM loads → ArkEscrowApp created
2. Elements mapped → Managers initialized
3. Event listeners attached → Cross-tab sync setup
4. Saved server URL checked → Auto-connect if available

### User Workflow
1. **Connect to Server** → Server validation → UI unlock
2. **Create/Import Wallet** → User auto-registration → UI update
3. **Discover Users** → Cross-tab synchronization → User list update
4. **Create Contract** → Validation → VEscrow script creation → Storage
5. **Execute Actions** → Role validation → Action simulation → Notification

### State Management
- **Local State**: Manager classes hold component state
- **Persistent State**: localStorage for users, contracts, server URL
- **Session State**: Wallets stored only in memory
- **Cross-Tab State**: localStorage events for synchronization

## 🔌 API Integration

### Ark SDK Integration
```typescript
// Server connection
const provider = new RestArkProvider(serverUrl);
await provider.getServerInfo();

// Wallet creation
const wallet = new Wallet(identity, provider);
const address = await wallet.getAddress();

// Transactions
const result = await wallet.sendToAddress(address, amount);
const settleResult = await wallet.settle();
```

### VEscrow Integration
```typescript
// Contract creation
const escrowScript = new VEscrow.Script({
    buyer: buyerPubkey,
    seller: sellerPubkey,
    arbitrator: arbitratorPubkey,
    server: serverPubkey
});

// Available actions
const releasePath = escrowScript.release();
const refundPath = escrowScript.refund();
```

## 🛠️ Development Guide

### Prerequisites
- Node.js v16+
- TypeScript knowledge
- Understanding of Bitcoin/Ark protocols

### Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type checking
npm run type-check
```

### Code Style
- TypeScript strict mode enabled
- ESM modules throughout
- Async/await for asynchronous operations
- Error handling with try/catch blocks
- Comprehensive type annotations

### Adding New Features
1. **New Manager**: Create class in separate file
2. **Update Types**: Add interfaces to types.ts
3. **Integration**: Wire into ArkEscrowApp
4. **UI Updates**: Add to UIManager if needed
5. **Testing**: Test all user workflows

### Debugging
- Browser DevTools for client-side debugging
- Console logging for state tracking
- Network tab for API call monitoring
- localStorage inspection for data persistence

## 🚀 Deployment

### Build Process
```bash
# Production build
npm run build

# Preview build
npm run serve
```

### Static Deployment
- Built files in `/dist` directory
- No server-side requirements
- Can be deployed to any static hosting
- CDN-friendly architecture

### Hosting Options
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Any static file server

### Environment Considerations
- HTTPS required for clipboard API
- Modern browser support needed
- Local storage availability required
- WebCrypto API support needed

## 🔒 Security Considerations

### Private Key Handling
- Generated using WebCrypto API
- Session-only storage (no persistence)
- Cleared on page unload
- Never transmitted over network

### Data Storage
- Users and contracts in localStorage
- No sensitive data persisted
- Cross-tab communication via storage events
- Server URLs cached for convenience

### Network Security
- HTTPS recommended for production
- Server certificate validation
- No API keys stored in client
- Error messages sanitized

## 📊 Performance

### Optimization Features
- Lazy loading of heavy operations
- Debounced UI updates
- Efficient DOM manipulation
- Minimal bundle size

### Resource Usage
- Small TypeScript bundle
- CSS-only styling (no frameworks)
- Efficient localStorage usage
- Minimal memory footprint

### Scalability
- Client-side only architecture
- No server load considerations
- Scales with user's device capabilities
- Network-dependent for Ark operations

---

*This documentation covers the complete Ark Escrow application architecture, functionality, and implementation details. For specific technical questions or contributions, refer to the individual source files and their inline documentation.*
