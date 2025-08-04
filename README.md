# Ark Escrow Demo

A comprehensive demonstration of multi-signature escrow contracts using the Ark blockchain SDK. This application showcases real-world escrow functionality with three-party contracts (buyer, seller, arbitrator) and secure multi-signature transaction workflows.

## Features

### Core Escrow Functionality
- **Three-Party Contracts**: Buyer, seller, and arbitrator roles
- **Multi-Signature Security**: Real cryptographic signatures from all required parties
- **Flexible Actions**: Release, refund, and direct settlement options
- **Real Blockchain Integration**: Actual Ark network transactions and VTXOs
- **Cross-Tab Synchronization**: Real-time updates across browser tabs
- **Persistent Storage**: Contract and user data stored locally

### Advanced Features
- **Boarding Coins Support**: Includes boarding coins in balance calculations
- **Private Key Management**: Secure wallet creation and key display
- **User-Friendly Names**: Persistent friendly names (Alice, Bob, Carol, etc.)
- **Real-Time Notifications**: Toast notifications for user actions
- **Contract State Reconstruction**: Dynamic state from blockchain data
- **Production-Ready Signing**: Multi-party cryptographic transaction signing

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Modern web browser with ES2020+ support
- Access to Ark testnet/mainnet (configurable)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd ark-escrow

# Install dependencies
npm install

# Start development server
npm run dev
```

### First Run
1. **Create Wallet**: Click "Create New Wallet" to generate a new Ark wallet
2. **Add Users**: Create multiple users (buyer, seller, arbitrator) for testing
3. **Create Contract**: Set up an escrow contract with the three parties
4. **Fund Contract**: Send funds to the escrow address
5. **Execute Actions**: Test release, refund, or direct settlement workflows

## Architecture

### Core Components

**`WalletManager`**: Handles wallet creation, import, and balance management
- Real Ark wallet integration with private key management
- Boarding coin support and balance calculations
- Secure key storage and display functionality

**`ContractManager`**: Manages escrow contracts and multi-signature workflows
- VEscrow script creation and management
- Real blockchain transaction creation using `buildOffchainTx`
- Multi-party cryptographic signing and submission
- PSBT serialization for localStorage persistence

**`ServerManager`**: Handles Ark network communication
- Real Ark provider and indexer connections
- Server key and unilateral delay fetching
- Transaction submission and finalization

**`UserManager`**: User discovery and friendly name management
- Persistent user storage with friendly names
- Cross-tab synchronization via localStorage events
- Public key to user name mapping

**`NotificationManager`**: User feedback and error handling
- Toast notifications for success/error states
- Real-time feedback during transaction processes

### Multi-Signature Workflow

1. **Transaction Creation**:
   - Initiator creates escrow transaction using `buildOffchainTx`
   - Initiator immediately signs both Ark transaction and checkpoints
   - Transaction stored as PSBT data in localStorage

2. **Co-Signature Collection**:
   - Required co-signers approve via UI
   - Each co-signer cryptographically signs the transaction
   - Signatures accumulated incrementally

3. **Transaction Execution**:
   - When all signatures collected, transaction submitted to Ark network
   - Checkpoint transactions finalized with all signatures
   - Real blockchain state updated

### Blockchain Integration

**Real Ark Transactions**: Uses actual Ark SDK methods:
- `buildOffchainTx`: Creates real virtual transactions
- `RestArkProvider.submitTx`: Submits to Ark network
- `RestArkProvider.finalizeTx`: Finalizes with checkpoints
- `RestIndexerProvider.getVtxos`: Queries blockchain state

**VEscrow Scripts**: Production-ready escrow contracts:
- Six spending paths: fund, release, refund, direct, unilateral, forfeit
- Real tapscript encoding and script generation
- Proper address-to-script conversion using `ArkAddress.decode()`

## Dependencies

### Core Ark SDK
- **@arkade-os/sdk**: Complete Ark blockchain SDK
  - `RestArkProvider`: Network transaction submission
  - `RestIndexerProvider`: Blockchain state queries
  - `VEscrow`: Escrow contract implementation
  - `buildOffchainTx`: Virtual transaction creation
  - `ArkAddress`: Address encoding/decoding

### Cryptographic Libraries
- **@scure/btc-signer**: Bitcoin transaction signing and PSBT handling
- **@scure/base**: Encoding utilities (hex, base64)

### Development Tools
- **Vite**: Modern build tool with hot reload
- **TypeScript**: Type-safe development
- **Modern CSS**: Responsive design with CSS Grid/Flexbox

## Key Features Explained

### Real Multi-Signature Security
Unlike simple approval systems, this implementation uses **real cryptographic signatures**:
- Each required party signs with their private key
- Signatures are cryptographically verified by the Ark network
- No single party can execute transactions alone

### Production-Ready Transaction Handling
- **PSBT Serialization**: Proper handling of Partially Signed Bitcoin Transactions
- **Cross-Tab Sync**: Real-time updates across browser instances
- **Error Recovery**: Robust error handling and user feedback
- **State Reconstruction**: Dynamic contract state from blockchain data

### User Experience Features
- **Friendly Names**: Persistent Alice/Bob/Carol naming for easy identification
- **Real-Time Updates**: Immediate UI updates on transaction state changes
- **Comprehensive Logging**: Detailed console output for debugging
- **Mobile Responsive**: Works on all device sizes

## Development

### Scripts
```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run serve        # Preview production build
npm run type-check   # TypeScript type checking
```

### Configuration Files
- **`vite.config.ts`**: Build configuration and development server
- **`tsconfig.json`**: TypeScript compiler options
- **`package.json`**: Dependencies and project metadata

### Code Organization
```
src/
├── app.ts              # Main application controller
├── wallet-manager.ts   # Wallet and balance management
├── contract-manager.ts # Escrow contracts and multi-sig
├── server-manager.ts   # Ark network communication
├── user-manager.ts     # User discovery and naming
├── notification-manager.ts # User feedback system
├── types.ts           # TypeScript type definitions
├── styles.css         # Modern responsive styling
└── index.html         # Application entry point
```

## Production Deployment

### Build for Production
```bash
npm run build
```

### Deployment Options
The built static files in `dist/` can be deployed to:
- **Netlify**: Automatic deployments from Git
- **Vercel**: Serverless static hosting
- **GitHub Pages**: Free static hosting
- **AWS S3 + CloudFront**: Scalable CDN deployment
- **Any static web server**: Apache, Nginx, etc.

### Environment Configuration
- **Ark Network**: Configure testnet vs mainnet in `ServerManager`
- **Server Endpoints**: Update Ark provider URLs for different networks
- **Security**: Ensure HTTPS for production wallet usage

## Security Considerations

### Private Key Management
- Private keys stored in browser localStorage (development only)
- **Production**: Integrate with hardware wallets or secure key management
- Keys displayed only when explicitly requested by user

### Multi-Signature Security
- All transactions require cryptographic signatures from required parties
- No single party can execute transactions unilaterally
- Real blockchain verification of all signatures

### Network Security
- All Ark network communication over HTTPS
- Transaction data cryptographically signed and verified
- No sensitive data transmitted in plaintext

## Testing

### Manual Testing Workflow
1. Create multiple wallets (buyer, seller, arbitrator)
2. Create escrow contract with all three parties
3. Fund the contract from buyer wallet
4. Test each action type (release, refund, direct settle)
5. Verify blockchain state updates correctly
6. Test cross-tab synchronization

### Network Testing
- Test on Ark testnet before mainnet deployment
- Verify transaction submission and finalization
- Check VTXO creation and spending
- Validate multi-signature requirements

## Troubleshooting

### Common Issues

**"Missing signatures" error**:
- Ensure all required parties have signed the transaction
- Check that initiator signed when creating transaction
- Verify co-signers signed when approving

**PSBT serialization errors**:
- Check localStorage for corrupted transaction data
- Clear browser storage and recreate transactions
- Verify PSBT data conversion between arrays and Uint8Arrays

**Network connection issues**:
- Verify Ark server endpoints are accessible
- Check network connectivity and CORS settings
- Ensure proper server key and delay configuration

### Debug Information
Enable detailed console logging to see:
- Transaction creation and signing processes
- PSBT data serialization/deserialization
- Network requests and responses
- Multi-signature workflow progress

## Contributing

This is a production-ready demonstration of Ark escrow functionality. Contributions welcome for:
- Additional escrow contract types
- Enhanced security features
- Improved user experience
- Extended blockchain integration
- Performance optimizations

## License

[Add appropriate license information]
