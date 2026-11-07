# Solana Tip Jar

Send a tip in SOL with a short message attached. The tip and message are recorded on the Solana
blockchain (devnet), and the app shows a live feed of recent tips and a leaderboard of top tippers.

Built by [Brage1025](https://github.com/Brage1025) for the Solana Hackathon (Nov 6–8, 2026), hosted by Major League Hacking.
This is my first hackathon and my first Solana project.

## Features

- Wallet picker with Phantom, Solflare, Coinbase Wallet and Trust Wallet, plus any other installed Wallet Standard wallet (for example Backpack)
- Send SOL to any address with a message of up to 140 characters (stored with the Memo program)
- Live "Recent tips" feed, newest first, with links to Solana Explorer
- "Top tippers" leaderboard (top 5 by total SOL)

## How it works

1. **Wallet:** your account on Solana. It signs the transaction.
2. **Transaction:** one transaction containing two instructions: a SOL transfer and a Memo with your message.
3. **Reading tips back:** the app fetches recent transactions for the jar address and reads the transfer and memo from each.
4. **Network:** devnet only as this is a proof of concept (free test SOL, no real money).

## Tech stack

React 19, TypeScript, Vite, `@solana/web3.js` v1, Solana Wallet Adapter (Phantom, Solflare, Coinbase, Trust).

## Run locally

Requires Node.js (LTS).

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Try it

1. Install the [Phantom](https://phantom.app) browser extension.
2. In Phantom: Settings → Developer Settings → enable Testnet Mode → select Solana Devnet.
3. Get free test SOL at https://faucet.solana.com (choose Devnet).
4. Click **Select Wallet**, connect, and send a tip.

## Build and deploy

```bash
npm run build
```

Deploy the generated `dist` folder to any static host (for example Netlify Drop or Vercel).

## Project structure

```
public/solana-logo.svg   logo and favicon
src/main.tsx             wallet and connection providers (devnet)
src/App.tsx              UI, sending tips, feed and leaderboard logic
src/styles.css           black and orange theme
```

## What I learned

- How a Solana wallet works: it holds the keys and signs transactions, and the app never sees the private key.
- The difference between devnet and mainnet, and how to get free test SOL from a faucet.
- A transaction is a bundle of instructions. Mine sends SOL and attaches a Memo in one atomic step.
- Every transaction pays a small network fee, even when you tip yourself.
- Anyone can verify a transaction on Solana Explorer, and the app reads its feed and leaderboard straight from the chain, with no database or backend.
- How to connect wallets with Solana Wallet Adapter, and how the wallet list depends on what is installed in the browser.
- Handling real-world issues in a live data feed, such as refreshes arriving out of order and keeping a stable newest-first list.
- How to take a project from idea to a deployed app within a weekend hackathon.

## Future ideas

- Look at options to tip with USDC or other SPL tokens, not only SOL.
- Write a custom on-chain program (with Anchor) that stores totals and tip goals, instead of reading them from transaction history.
- Show wallet names (such as .sol domains) instead of shortened addresses.
- Reward top tippers with a badge or NFT.
- Support multiple jars, each with its own page and link.
- Index tips with a lightweight service so the leaderboard covers all history, not only recent transactions.
- Add a mainnet mode with clear warnings.

## License

Released under the MIT License. See [LICENSE](LICENSE).

## Credits

The Solana logo was obtained from [solana.com/branding](https://solana.com/branding) and is used unaltered, only to indicate that this app is built on the Solana network. The Solana name and logos are marks of the Solana Foundation. Downloading or using them does not grant ownership or trademark rights, and they are not covered by this project's MIT License. Use of the marks is subject to the Solana Foundation's Brand Guidelines, which may change.

This is an independent, non-commercial hackathon project. It is not affiliated with, sponsored by, or endorsed by the Solana Foundation.

---

<div align="center">

_"To &lt;div&gt; or not to &lt;div&gt;, that is the question."_
— [Brage1025](https://github.com/Brage1025)

</div>
