import { useState, useRef, useEffect } from 'react'
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers'
import './Acquiring.css'

const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function tokenInfo() view returns (string name, string symbol, uint8 decimals)',
]

const CONTRACT_ADDR = '0x6F765509c7D319b5760392dFf927557EF90d319C'
const MERCHANT_ADDR = '0xA72C11A8D266058Aa025969367124a2025E2085D'

const PRODUCTS = [
  { id: 1, name: '🎧 Наушники', price: 50, emoji: '🎧' },
  { id: 2, name: '👟 Кроссовки', price: 120, emoji: '👟' },
  { id: 3, name: '⌚ Часы', price: 250, emoji: '⌚' },
  { id: 4, name: '📱 Чехол', price: 15, emoji: '📱' },
]

export default function Acquiring({ onBack }) {
  const [logs, setLogs] = useState([])
  const [account, setAccount] = useState(null)
  const [signer, setSigner] = useState(null)
  const [tokenBalance, setTokenBalance] = useState(null)
  const [merchantBalance, setMerchantBalance] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [loadingPay, setLoadingPay] = useState(false)
  const logsEndRef = useRef(null)

  const addLog = (type, msg) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { time, type, msg }])
  }

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const connect = async () => {
    if (!window.ethereum) return addLog('error', 'MetaMask не установлен')
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new BrowserProvider(window.ethereum)
      const sign = await provider.getSigner()
      const addr = await sign.getAddress()
      setAccount(addr)
      setSigner(sign)
      addLog('success', `Кошелек подключен: ${addr.slice(0,6)}...${addr.slice(-4)}`)

      const contract = new Contract(CONTRACT_ADDR, TOKEN_ABI, provider)
      const bal = await contract.balanceOf(addr)
      setTokenBalance(formatEther(bal))
      addLog('info', `Баланс DMUSDT: ${formatEther(bal)}`)

      const mBal = await contract.balanceOf(MERCHANT_ADDR)
      setMerchantBalance(formatEther(mBal))
      addLog('info', `Баланс мерчанта: ${formatEther(mBal)} DMUSDT`)
    } catch (e) {
      addLog('error', `Ошибка: ${e.message}`)
    }
  }

  const pay = async (product) => {
    if (!account || !signer) return addLog('error', 'Сначала подключи кошелек')
    setLoadingPay(true)
    setSelectedProduct(product)
    try {
      const provider = new BrowserProvider(window.ethereum)
      const sign = await provider.getSigner()
      const priceWei = parseEther(String(product.price))

      addLog('info', `🔵 Покупка: ${product.name} за ${product.price} DMUSDT`)
      addLog('info', '🔵 Проверка баланса...')

      const contract = new Contract(CONTRACT_ADDR, TOKEN_ABI, sign)
      const bal = await contract.balanceOf(account)
      addLog('info', `Баланс покупателя: ${formatEther(bal)} DMUSDT`)

      if (bal < priceWei) {
        addLog('error', `❌ Недостаточно DMUSDT (нужно ${product.price}, есть ${formatEther(bal)})`)
        setLoadingPay(false)
        return
      }

      addLog('info', '🔵 Одобрение токенов для перевода (approve)...')
      const approveTx = await contract.approve(account, priceWei)
      addLog('pending', `⏳ approve tx: ${approveTx.hash.slice(0,10)}...`)
      await approveTx.wait()
      addLog('success', `✅ approve подтвержден`)

      addLog('info', '🔵 Отправка DMUSDT мерчанту...')
      const tx = await contract.transfer(MERCHANT_ADDR, priceWei)
      addLog('pending', `⏳ transfer tx: ${tx.hash.slice(0,10)}...`)
      await tx.wait()
      addLog('success', `✅ Оплата прошла! ${product.price} DMUSDT → мерчанту`)

      const newBal = await contract.balanceOf(account)
      setTokenBalance(formatEther(newBal))
      const mBal = await contract.balanceOf(MERCHANT_ADDR)
      setMerchantBalance(formatEther(mBal))

      addLog('success', `💰 Остаток: ${formatEther(newBal)} DMUSDT`)
      addLog('success', `💰 Мерчант: ${formatEther(mBal)} DMUSDT`)
      addLog('info', '📊 Транзакция завершена')
    } catch (e) {
      addLog('error', `❌ Ошибка: ${e.message}`)
    }
    setLoadingPay(false)
  }

  return (
    <div className="acquiring">
      <header className="aq-header">
        <button className="btn btn-secondary aq-back" onClick={onBack}>← Назад</button>
        <h1>🧪 Тестовый эквайринг DMUSDT</h1>
        <p className="aq-subtitle">Симуляция покупки товара с оплатой в DMUSDT на Sepolia</p>
      </header>

      <div className="aq-split">
        {/* Левая панель: магазин */}
        <div className="aq-store">
          <div className="aq-card">
            <h2>🏪 Магазин</h2>
            {!account ? (
              <div className="aq-connect">
                <p>Подключи кошелек с DMUSDT для тестовой покупки</p>
                <button className="btn btn-primary" onClick={connect}>🔌 Connect Wallet</button>
              </div>
            ) : (
              <>
                <div className="aq-wallet-info">
                  <span>👤 {account.slice(0,6)}...{account.slice(-4)}</span>
                  <span className="aq-balance">💰 {tokenBalance !== null ? Number(tokenBalance).toFixed(2) : '...'} DMUSDT</span>
                </div>

                <div className="aq-products">
                  {PRODUCTS.map(p => (
                    <div key={p.id} className={`aq-product ${selectedProduct?.id === p.id ? 'selected' : ''}`}>
                      <div className="aq-product-info">
                        <span className="aq-product-name">{p.emoji} {p.name}</span>
                        <span className="aq-product-price">{p.price} DMUSDT</span>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => pay(p)}
                        disabled={loadingPay}
                      >
                        {loadingPay && selectedProduct?.id === p.id ? '⏳...' : 'Купить'}
                      </button>
                    </div>
                  ))}
                </div>

                {selectedProduct && loadingPay && (
                  <div className="aq-paying">
                    <div className="spinner"></div>
                    <span>Обработка платежа...</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="aq-card">
            <h3>🏦 Мерчант</h3>
            <p className="aq-merchant-addr">{MERCHANT_ADDR.slice(0,6)}...{MERCHANT_ADDR.slice(-4)}</p>
            <p className="aq-balance">💰 {merchantBalance !== null ? Number(merchantBalance).toFixed(2) : '...'} DMUSDT</p>
          </div>
        </div>

        {/* Правая панель: логи эквайринга */}
        <div className="aq-logs-panel">
          <div className="aq-card aq-logs-card">
            <h2>📋 Логи эквайринга</h2>
            <div className="aq-logs">
              {logs.length === 0 ? (
                <div className="aq-logs-empty">
                  <p>Подключи кошелек и соверши покупку</p>
                  <p className="aq-hint">Здесь будут отображаться все события транзакции</p>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`aq-log aq-log-${log.type}`}>
                    <span className="aq-log-time">{log.time}</span>
                    <span className="aq-log-msg">{log.msg}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          <div className="aq-info">
            <p>🔗 <strong>Контракт:</strong> <code>{CONTRACT_ADDR.slice(0,10)}...{CONTRACT_ADDR.slice(-6)}</code></p>
            <p>🌐 <strong>Сеть:</strong> Sepolia (Chain ID: 11155111)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
