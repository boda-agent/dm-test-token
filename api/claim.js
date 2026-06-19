import { JsonRpcProvider, Wallet, parseEther } from 'ethers'

const PRIVATE_KEY = process.env.SPONSOR_PRIVATE_KEY
const RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka'

export default async function handler(req, res) {
  // CORS
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

    // Check sponsor balance
    const balance = await provider.getBalance(wallet.address)
    if (balance < parseEther('0.01')) {
      return res.status(500).json({ error: 'Sponsor wallet is dry' })
    }

    // Send 0.05 Sepolia ETH
    const tx = await wallet.sendTransaction({
      to: address,
      value: parseEther('0.05'),
    })

    await tx.wait()

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      amount: '0.05',
    })
  } catch (err) {
    console.error('Claim error:', err)
    return res.status(500).json({ error: err.message })
  }
}
