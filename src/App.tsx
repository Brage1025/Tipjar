import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

// The "Memo" program is a built-in Solana program that stores a short text note
// inside a transaction. This is how we attach a message to a tip.
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

type Tip = {
  signature: string;
  from: string;
  sol: number;
  message: string;
  time: number | null;
  slot: number;
};

const WALLET_TIMEOUT_MS = 45_000;

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

const ago = (t: number | null) => {
  if (!t) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function App() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tips, setTips] = useState<Tip[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const reqId = useRef(0); // lets us ignore out-of-date responses

  // Default the jar to your own wallet once connected (so you can tip yourself to test).
  useEffect(() => {
    if (publicKey && !recipient) setRecipient(publicKey.toBase58());
  }, [publicKey]); // eslint-disable-line

  const loadBalance = useCallback(async () => {
    if (!publicKey) return setBalance(null);
    setBalance((await connection.getBalance(publicKey)) / LAMPORTS_PER_SOL);
  }, [connection, publicKey]);

  // Read recent transactions sent to the jar address and pull out amount + memo.
  // New results are MERGED into what we already have (keyed by signature) and always
  // sorted newest-first by slot, so the list can never flip-flop or shuffle.
  const loadTips = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const jar = new PublicKey(recipient);
      const sigs = await connection.getSignaturesForAddress(jar, { limit: 50 });
      const txs = await connection.getParsedTransactions(
        sigs.map((s) => s.signature),
        { maxSupportedTransactionVersion: 0 }
      );
      const found: Tip[] = [];
      txs.forEach((tx, i) => {
        if (!tx || tx.meta?.err) return;
        let sol = 0, from = "", memo = "";
        for (const ix of tx.transaction.message.instructions as any[]) {
          if (ix.program === "spl-memo") memo = String(ix.parsed);
          if (ix.program === "system" && ix.parsed?.type === "transfer" && ix.parsed.info.destination === recipient) {
            sol = ix.parsed.info.lamports / LAMPORTS_PER_SOL;
            from = ix.parsed.info.source;
          }
        }
        if (sol > 0)
          found.push({ signature: sigs[i].signature, from, sol, message: memo, time: sigs[i].blockTime ?? null, slot: sigs[i].slot });
      });
      if (id !== reqId.current) return; // a newer request started; drop this stale one
      setTips((prev) => {
        const all = new Map(prev.map((t) => [t.signature, t]));
        found.forEach((t) => all.set(t.signature, t));
        return [...all.values()].sort((a, b) => b.slot - a.slot || (a.signature < b.signature ? -1 : 1));
      });
    } catch {
      // On a network hiccup keep showing what we already have.
    }
  }, [connection, recipient]);

  // Switching jar address starts a fresh list.
  useEffect(() => {
    reqId.current++;
    setTips([]);
  }, [recipient]);

  // Leaderboard: add up every tip by sender, biggest total first.
  const leaders = useMemo(() => {
    const totals = new Map<string, { sol: number; count: number }>();
    for (const t of tips) {
      const cur = totals.get(t.from) ?? { sol: 0, count: 0 };
      totals.set(t.from, { sol: cur.sol + t.sol, count: cur.count + 1 });
    }
    return [...totals.entries()]
      .map(([from, v]) => ({ from, ...v }))
      .sort((a, b) => b.sol - a.sol)
      .slice(0, 5);
  }, [tips]);

  useEffect(() => {
    if (!recipient) return;
    loadTips();
    const id = setInterval(loadTips, 10000); // refresh every 10s
    return () => clearInterval(id);
  }, [loadTips, recipient]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  async function sendTip() {
    if (!publicKey) return;
    setBusy(true);
    setStatus("Waiting for you to approve in your wallet…");
    try {
      const to = new PublicKey(recipient);
      const lamports = Math.round(parseFloat(amount) * LAMPORTS_PER_SOL);
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: to, lamports })
      );
      if (message.trim()) {
        tx.add(
          new TransactionInstruction({
            keys: [],
            programId: MEMO_PROGRAM_ID,
            data: new TextEncoder().encode(message.trim().slice(0, 140)) as any,
          })
        );
      }
      // Give the wallet up to 45 seconds to respond. If it never shows an approval
      // prompt, stop waiting so the button does not stay stuck on "Sending...".
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const walletCall = sendTransaction(tx, connection);
      walletCall
        .then(() => {
          // The user approved after we gave up: refresh so the tip still shows up.
          if (timedOut) {
            setStatus("Your tip was approved late and has been sent.");
            setTimeout(() => { loadTips(); loadBalance(); }, 3000);
          }
        })
        .catch(() => {});
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error("WALLET_TIMEOUT"));
        }, WALLET_TIMEOUT_MS);
      });
      let sig: string;
      try {
        sig = await Promise.race([walletCall, timeout]);
      } finally {
        clearTimeout(timer);
      }
      setStatus("Sent! Waiting for the network to confirm…");
      await connection.confirmTransaction(sig, "confirmed");
      setStatus(`Confirmed · ${short(sig)}`);
      setMessage("");
      loadTips();
      loadBalance();
    } catch (e: any) {
      setStatus(
        e?.message === "WALLET_TIMEOUT"
          ? "No response from your wallet. Open your wallet, check for a pending request, then try again."
          : `Failed: ${e.message ?? e}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <div className="brand">
          {/* Put the official logo at public/solana-logo.svg; it hides itself if the file is missing */}
          <img
            src="/solana-logo.svg"
            alt="Solana"
            className="logo"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
          <h1>Solana Tip Jar</h1>
          <span className="net">Devnet</span>
        </div>
        <WalletMultiButton />
      </header>
      <p className="sub">
        Send a tip with a message. Everything is stored on the Solana blockchain (devnet — free play money).
      </p>

      {publicKey && balance !== null && (
        <p className="bal">Your balance: {balance.toFixed(3)} SOL</p>
      )}

      <section className="card">
        <label>Jar address (who gets the tip)</label>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Paste a wallet address" />
        <div className="row">
          <div>
            <label>Amount (SOL)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div style={{ flex: 3 }}>
            <label>Message (max 140 chars)</label>
            <input value={message} maxLength={140} onChange={(e) => setMessage(e.target.value)} placeholder="Great work!" />
          </div>
        </div>
        <button className="send" disabled={!publicKey || busy || !recipient} onClick={sendTip}>
          {publicKey ? (busy ? "Sending…" : "Send tip") : "Connect wallet first"}
        </button>
        {status && <p className="status">{status}</p>}
      </section>

      <h2>Top tippers</h2>
      {leaders.length === 0 && <p className="sub">Nobody yet — send the first tip!</p>}
      {leaders.map((l, i) => (
        <div className={`leader ${publicKey?.toBase58() === l.from ? "me" : ""}`} key={l.from}>
          <span className="rank">{["🥇", "🥈", "🥉"][i] ?? ""}</span>
          <span className="who">{short(l.from)}{publicKey?.toBase58() === l.from ? " (you)" : ""}</span>
          <span className="tot">{Number(l.sol.toFixed(4))} SOL · {l.count} tip{l.count > 1 ? "s" : ""}</span>
        </div>
      ))}

      <h2>Recent tips</h2>
      {tips.length === 0 && <p className="sub">No tips yet — be the first!</p>}
      {tips.slice(0, 10).map((t) => (
        <div className="tip" key={t.signature}>
          <div className="tip-top">
            <span>
              <b>{t.sol} SOL</b> from <span className="mono" title={t.from}>{short(t.from)}</span>
            </span>
            <span className="ago">{ago(t.time)}</span>
          </div>
          {t.message && <div className="msg">“{t.message}”</div>}
          <a href={`https://explorer.solana.com/tx/${t.signature}?cluster=devnet`} target="_blank" rel="noreferrer">
            View on Explorer ↗
          </a>
        </div>
      ))}

      <footer>
        <p>
          Created by{" "}
          <a href="https://github.com/Brage1025" target="_blank" rel="noreferrer">
            Brage1025
          </a>{" "}
          for the Solana Hackathon, Nov 6–8, 2026.
        </p>
        <p>
          The Solana logo is from{" "}
          <a href="https://solana.com/branding" target="_blank" rel="noreferrer">
            solana.com/branding
          </a>{" "}
          and belongs to the Solana Foundation. This project is not affiliated with or endorsed by Solana.
        </p>
      </footer>
    </main>
  );
}
