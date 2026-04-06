# Aequor

A modern Solana monorepo containing a web frontend, an API backend, and Anchor-based on-chain programs.

## Project Structure

- **`apps/web`**: Next.js frontend application.
- **`apps/api`**: Express.js API backend powered by TypeScript.
- **`chain`**: Solana on-chain programs using the Anchor framework.

## Getting Started

### Prerequisites

- Node.js & npm/yarn
- Rust & Cargo
- Solana CLI
- Anchor Framework

### Installation

Clone the repository and install dependencies from the root:

```bash
yarn install
```

### Development

You can run the web and API applications concurrently from the root:

```bash
# Run web frontend
npm run web

# Run API backend
npm run api
```

### On-chain Programs

Navigate to the `chain` directory to manage Solana programs:

```bash
cd chain

# Build programs
anchor build

# Run tests
anchor test

# Deploy to localnet
anchor deploy
```

## License

MIT
