import { JsonRpcProvider, Wallet, Contract, parseEther } from 'ethers'

const PRIVATE_KEY = process.env.SPONSOR_PRIVATE_KEY
const RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka'
const CONTRACT_ADDRESS = '0x6F765509c7D319b5760392dFf927557EF90d319C'

const TOKEN_ABI = [
  'function sponsorMint(address to) external',
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' })

  try {
    const { address } = req.body
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid address' })
    }

    if (!PRIVATE_KEY) {
      return res.status(500).json({ error: 'Sponsor wallet not configured' })
    }

    const provider = new JsonRpcProvider(RPC_URL)
    const wallet = new Wallet(PRIVATE_KEY, provider)
    const contract = new Contract(CONTRACT_ADDRESS, TOKEN_ABI, wallet)

    const sponsorAddr = await wallet.getAddress()

    // Check sponsor balance
    const balance = await provider.getBalance(sponsorAddr)
    const needed = parseEther('0.02')
    if (balance < needed) {
      return res.status(500).json({ error: 'Sponsor wallet is dry' })
    }

    // Step 1: Send 0.02 Sepolia ETH for gas
    const tx1 = await wallet.sendTransaction({
      to: address,
      value: parseEther('0.02'),
    })
    await tx1.wait()

    // Step 2: Sponsor mint 1000 DMUSDT directly to user
    const tx2 = await contract.sponsorMint(address)
    await tx2.wait()

    return res.status(200).json({
      success: true,
      ethTxHash: tx1.hash,
      mintTxHash: tx2.hash,
      ethAmount: '0.02',
      tokenAmount: '1000',
    })
  } catch (err) {
    console.error('ClaimMint error:', err)
    return res.status(500).json({ error: err.message })
  }
}
