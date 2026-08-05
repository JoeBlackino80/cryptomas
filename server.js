// ============================================
// CryptoMas Backend Server
// Custodial wallets + Duel staking + Rewards
// ============================================

import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { 
  createTransferInstruction, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import crypto from 'crypto';
import bs58 from 'bs58';

const app = express();
app.use(express.json());

// ============================================
// CONFIG (move to .env in production!)
// ============================================
const CONFIG = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/cryptomas',
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-to-32-char-secret',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '12345678901234567890123456789012',
  SOLANA_RPC: process.env.SOLANA_RPC || 'https://api.devnet.solana.com',
  CMAS_MINT: process.env.CMAS_MINT || 'YOUR_CMAS_MINT_ADDRESS_HERE',
  TREASURY_SECRET: process.env.TREASURY_SECRET || 'YOUR_TREASURY_BASE58_KEY_HERE',
  MATCH_FEE_PERCENT: 0.15,
  BURN_PERCENT: 0.05,
  TREASURY_PERCENT: 0.10
};

// ============================================
// ENCRYPTION HELPERS
// ============================================
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(CONFIG.ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(CONFIG.ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// ============================================
// SOLANA SETUP
// ============================================
const connection = new Connection(CONFIG.SOLANA_RPC, 'confirmed');
const CMAS_MINT = new PublicKey(CONFIG.CMAS_MINT);
const treasury = Keypair.fromSecretKey(bs58.decode(CONFIG.TREASURY_SECRET));
const treasuryATA = await getAssociatedTokenAddress(CMAS_MINT, treasury.publicKey);

// ============================================
// MONGOOSE MODELS
// ============================================

// PLAYER MODEL
const playerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  wallet: {
    publicKey: { type: String, required: true, unique: true },
    encryptedSecretKey: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  stats: {
    elo: { type: Number, default: 1000 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalStaked: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 } // off-chain cache
  },
  externalWallet: {
    address: { type: String, default: null },
    verified: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now }
});

playerSchema.pre('save', function(next) {
  if (this.isNew && !this.wallet.publicKey) {
    const keypair = Keypair.generate();
    this.wallet.publicKey = keypair.publicKey.toString();
    this.wallet.encryptedSecretKey = encrypt(Buffer.from(keypair.secretKey).toString('base64'));
  }
  next();
});

playerSchema.methods.getWalletKeypair = function() {
  const secretKeyBase64 = decrypt(this.wallet.encryptedSecretKey);
  const secretKey = Buffer.from(secretKeyBase64, 'base64');
  return Keypair.fromSecretKey(secretKey);
};

const Player = mongoose.model('Player', playerSchema);

// MATCH MODEL
const matchSchema = new mongoose.Schema({
  player1: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  stake: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'active', 'completed', 'cancelled'], default: 'pending' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  player1Score: { type: Number, default: 0 },
  player2Score: { type: Number, default: 0 },
  feeBurned: { type: Number, default: 0 },
  feeTreasury: { type: Number, default: 0 },
  signature: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
});

const Match = mongoose.model('Match', matchSchema);

// ============================================
// MIDDLEWARE
// ============================================
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.player = jwt.verify(token, CONFIG.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================
// AUTH ROUTES
// ============================================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    const existing = await Player.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ error: 'Email or username taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const player = new Player({ email, password: hashedPassword, username });
    await player.save();

    const token = jwt.sign({ id: player._id, username: player.username }, CONFIG.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      player: {
        id: player._id,
        username: player.username,
        walletAddress: player.wallet.publicKey,
        balance: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const player = await Player.findOne({ email });
    if (!player) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, player.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: player._id, username: player.username }, CONFIG.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      player: {
        id: player._id,
        username: player.username,
        walletAddress: player.wallet.publicKey,
        balance: player.stats.currentBalance
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WALLET ROUTES
// ============================================

// GET BALANCE
app.get('/api/wallet/balance', authMiddleware, async (req, res) => {
  try {
    const player = await Player.findById(req.player.id);
    const ata = await getAssociatedTokenAddress(CMAS_MINT, new PublicKey(player.wallet.publicKey));

    let blockchainBalance = 0;
    try {
      const account = await connection.getTokenAccountBalance(ata);
      blockchainBalance = account.value.uiAmount || 0;
    } catch (e) {
      // Account doesn't exist yet
    }

    res.json({
      walletAddress: player.wallet.publicKey,
      gameBalance: player.stats.currentBalance,
      blockchainBalance: blockchainBalance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DEPOSIT CMAS (from external Phantom to game wallet)
app.post('/api/wallet/deposit', authMiddleware, async (req, res) => {
  // Player sends CMAS from their Phantom to their custodial wallet
  // This is verified by checking blockchain balance increase
  res.json({ message: 'Send CMAS to your game wallet address shown in profile' });
});

// WITHDRAW CMAS (from game to external Phantom)
app.post('/api/wallet/withdraw', authMiddleware, async (req, res) => {
  try {
    const { amount, externalAddress } = req.body;
    const player = await Player.findById(req.player.id);

    if (player.stats.currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient game balance' });
    }

    const playerKeypair = player.getWalletKeypair();
    const playerATA = await getAssociatedTokenAddress(CMAS_MINT, playerKeypair.publicKey);
    const externalATA = await getAssociatedTokenAddress(CMAS_MINT, new PublicKey(externalAddress));

    const tx = new Transaction();

    // Create external ATA if needed
    const extInfo = await connection.getAccountInfo(externalATA);
    if (!extInfo) {
      tx.add(createAssociatedTokenAccountInstruction(
        playerKeypair.publicKey, externalATA, new PublicKey(externalAddress), CMAS_MINT
      ));
    }

    tx.add(createTransferInstruction(playerATA, externalATA, playerKeypair.publicKey, amount * 10**9));

    const signature = await connection.sendTransaction(tx, [playerKeypair]);
    await connection.confirmTransaction(signature);

    player.stats.currentBalance -= amount;
    await player.save();

    res.json({ signature, amount, explorer: `https://solscan.io/tx/${signature}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MATCH / DUEL ROUTES
// ============================================

// CREATE MATCH (queue)
app.post('/api/match/create', authMiddleware, async (req, res) => {
  try {
    const { stake } = req.body;
    const player = await Player.findById(req.player.id);

    if (player.stats.currentBalance < stake) {
      return res.status(400).json({ error: 'Insufficient balance for stake' });
    }

    // Deduct stake
    player.stats.currentBalance -= stake;
    player.stats.totalStaked += stake;
    await player.save();

    // TODO: Add to matchmaking queue
    // For now, return match ID waiting for opponent
    const match = new Match({
      player1: player._id,
      stake: stake,
      status: 'pending'
    });
    await match.save();

    res.json({ matchId: match._id, status: 'waiting_for_opponent', stake });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JOIN MATCH
app.post('/api/match/join', authMiddleware, async (req, res) => {
  try {
    const { matchId } = req.body;
    const player = await Player.findById(req.player.id);
    const match = await Match.findById(matchId);

    if (!match || match.status !== 'pending') {
      return res.status(400).json({ error: 'Match not available' });
    }
    if (match.player1.toString() === player._id.toString()) {
      return res.status(400).json({ error: 'Cannot join your own match' });
    }
    if (player.stats.currentBalance < match.stake) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    player.stats.currentBalance -= match.stake;
    player.stats.totalStaked += match.stake;
    await player.save();

    match.player2 = player._id;
    match.status = 'active';
    await match.save();

    res.json({ matchId: match._id, status: 'active', opponent: match.player1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SUBMIT RESULT (server-authoritative in production!)
app.post('/api/match/result', authMiddleware, async (req, res) => {
  try {
    const { matchId, winnerId } = req.body;
    const match = await Match.findById(matchId);

    if (!match || match.status !== 'active') {
      return res.status(400).json({ error: 'Invalid match' });
    }

    const totalPot = match.stake * 2;
    const fee = Math.floor(totalPot * CONFIG.MATCH_FEE_PERCENT);
    const burnAmount = Math.floor(totalPot * CONFIG.BURN_PERCENT);
    const treasuryAmount = Math.floor(totalPot * CONFIG.TREASURY_PERCENT);
    const winnerPrize = totalPot - fee;

    const winner = await Player.findById(winnerId);

    // Transfer prize to winner's game balance (off-chain for speed)
    winner.stats.currentBalance += winnerPrize;
    winner.stats.wins += 1;
    winner.stats.totalEarned += winnerPrize;
    await winner.save();

    // Update loser
    const loserId = match.player1.toString() === winnerId ? match.player2 : match.player1;
    const loser = await Player.findById(loserId);
    loser.stats.losses += 1;
    await loser.save();

    // TODO: On-chain burn and treasury transfer (batch daily for efficiency)

    match.winner = winnerId;
    match.status = 'completed';
    match.feeBurned = burnAmount;
    match.feeTreasury = treasuryAmount;
    match.completedAt = new Date();
    await match.save();

    res.json({
      winner: winner.username,
      prize: winnerPrize,
      burned: burnAmount,
      treasury: treasuryAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LEADERBOARD
// ============================================
app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await Player.find()
      .sort({ 'stats.elo': -1 })
      .limit(100)
      .select('username stats.elo stats.wins stats.losses');

    res.json(topPlayers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================
mongoose.connect(CONFIG.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(CONFIG.PORT, () => {
      console.log(`CryptoMas server running on port ${CONFIG.PORT}`);
      console.log(`Treasury: ${treasury.publicKey.toString()}`);
    });
  })
  .catch(err => console.error('MongoDB error:', err));
