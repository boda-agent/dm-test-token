import { useState, useRef, useEffect, useCallback } from 'react'
import { JsonRpcProvider, Contract, formatEther } from 'ethers'
import './Acquiring.css'

const RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka'
const CONTRACT_ADDR = '0x6F765509c7D319b5760392dFf927557EF90d319C'
const MERCHANT_ADDR = '0xA72C11A8D266058Aa025969367124a2025E2085D'

const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

const PRODUCTS = [
  { id: 1, name: '🎧 Наушники', price: 50, address: '0xA72C11A8D266058Aa025969367124a2025E2085D' },
  { id: 2, name: '👟 Кроссовки', price: 120, address: '0xA72C11A8D266058Aa025969367124a2025E2085D' },
  { id: 3, name: '⌚ Часы', price: 250, address: '0xA72C11A8D266058Aa025969367124a2025E2085D' },
  { id: 4, name: '📱 Чехол', price: 15, address: '0xA72C11A8D266058Aa025969367124a2025E2085D' },
]

export default function Acquiring({ onBack }) {
  const [logs, setLogs] = useState([])
  const [merchantBalance, setMerchantBalance] = useState(null)
  const [modal, setModal] = useState(null)
  const logsEndRef = useRef(null)
  const pollRef = useRef(null)
  const startBlockRef = useRef(null)

  const addLog = (type, msg) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { time, type, msg }])
  }

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const fetchBalance = useCallback(async () => {
    try {
      const provider = new JsonRpcProvider(RPC_URL)
      const contract = new Contract(CONTRACT_ADDR, TOKEN_ABI, provider)
      const bal = await contract.balanceOf(MERCHANT_ADDR)
      const formatted = formatEther(bal)
      setMerchantBalance(formatted)
      return bal
    } catch { return null }
  }, [])

  useEffect(() => { fetchBalance() }, [fetchBalance])

  // Открыть платеж
  const openPayment = (product) => {
    const paymentId = `PAY-${Date.now().toString(36).toUpperCase()}`
    setModal({ product, status: 'pending', paymentId, fromBlock: null })

    addLog('info', `🆕 Платеж #${paymentId}`)
    addLog('info', `🟢 Товар: ${product.name} | Сумма: ${product.price} DMUSDT`)
    addLog('info', `🏦 Адрес: ${product.address.slice(0,6)}...${product.address.slice(-4)}`)

    // Стартуем
    startPolling(paymentId, product)
  }

  // Поиск Transfer events
  const startPolling = async (paymentId, product) => {
    const provider = new JsonRpcProvider(RPC_URL)
    const contract = new Contract(CONTRACT_ADDR, TOKEN_ABI, provider)
    const currentBlock = await provider.getBlockNumber()
    startBlockRef.current = currentBlock

    const targetWei = product.price * 10n ** 18n
    addLog('pending', `⏳ Поиск перевода ${product.price} DMUSDT на ${product.address.slice(0,6)}...`)
    addLog('pending', `⏳ Стартовый блок: ${currentBlock}`)

    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const events = await contract.queryFilter(
          contract.filters.Transfer(null, product.address),
          startBlockRef.current,
          'latest'
        )

        for (const event of events) {
          if (event.args.value >= targetWei) {
            clearInterval(pollRef.current)
            const from = event.args.from
            const txHash = event.transactionHash

            addLog('success', `✅ Платеж #${paymentId} обнаружен!`)
            addLog('success', `💰 Сумма: ${formatEther(event.args.value)} DMUSDT`)
            addLog('success', `👤 Отправитель: ${from.slice(0,6)}...${from.slice(-4)}`)
            addLog('info', `🔗 TX: ${txHash.slice(0,10)}...`)
            addLog('info', `📊 Платеж подтвержден на блоке ${event.blockNumber}`)

            setMerchantBalance(formatEther(await contract.balanceOf(MERCHANT_ADDR)))
            setModal({ product, status: 'confirmed', paymentId, txHash })
            return
          }
        }
      } catch (e) {
        addLog('error', `❌ Ошибка поиска: ${e.message}`)
      }

      if (attempts > 90) {
        clearInterval(pollRef.current)
        setModal({ product, status: 'error', paymentId })
        addLog('error', `❌ Таймаут платежа #${paymentId}`)
      }
    }, 2000)
  }

  const closeModal = () => {
    setModal(null)
    clearInterval(pollRef.current)
  }

  return (
    <div className="acquiring">
      <header className="aq-header">
        <button className="btn btn-secondary aq-back" onClick={onBack}>← Назад</button>
        <h1>🧪 Тестовый эквайринг DMUSDT</h1>
        <p className="aq-subtitle">Выбери товар, отправь DMUSDT на указанный адрес — система найдет платеж по Transfer event</p>
      </header>

      <div className="aq-split">
        {/* Левая панель */}
        <div className="aq-store">
          <div className="aq-card">
            <h2>🏪 Товары</h2>
            <div className="aq-products">
              {PRODUCTS.map(p => (
                <div key={p.id} className="aq-product">
                  <div className="aq-product-info">
                    <span className="aq-product-name">{p.name}</span>
                    <span className="aq-product-price">{p.price} DMUSDT</span>
                  </div>
                  <button className="btn btn-accent btn-sm" onClick={() => openPayment(p)}>
                    Оплатить
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="aq-card">
            <h2>🏦 Мерчант</h2>
            <div className="aq-merchant-info">
              <div className="aq-merchant-row">
                <span>Баланс:</span>
                <span className="aq-balance">{merchantBalance !== null ? Number(merchantBalance).toFixed(2) : '...'} DMUSDT</span>
                <button className="btn btn-small btn-secondary" onClick={() => {
                  fetchBalance()
                  addLog('info', '🔄 Баланс обновлен')
                }}>🔄</button>
              </div>
            </div>
          </div>
        </div>

        {/* Правая панель: логи */}
        <div className="aq-logs-panel">
          <div className="aq-card aq-logs-card">
            <h2>📋 Логи эквайринга</h2>
            <div className="aq-logs">
              {logs.length === 0 ? (
                <div className="aq-logs-empty">
                  <p>Нажми "Оплатить" на товаре</p>
                  <p className="aq-hint">Система будет отслеживать переводы через Transfer events</p>
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
            <p>🔗 <strong>Контракт:</strong> <code>0x6F7655...d319C</code></p>
            <p>🌐 <strong>Сеть:</strong> Sepolia (11155111)</p>
          </div>
        </div>
      </div>

      {/* Модалка */}
      {modal && (
        <div className="aq-modal-overlay" onClick={() => modal.status !== 'pending' && closeModal()}>
          <div className="aq-modal" onClick={e => e.stopPropagation()}>
            {modal.status === 'pending' && (
              <>
                <div className="aq-modal-spinner">
                  <div className="spinner-lg"></div>
                </div>
                <h2>⏳ Ожидание платежа</h2>
                <div className="aq-modal-details">
                  <div className="aq-modal-row">
                    <span>Платеж</span>
                    <strong>{modal.paymentId}</strong>
                  </div>
                  <div className="aq-modal-row">
                    <span>Товар</span>
                    <strong>{modal.product.name}</strong>
                  </div>
                  <div className="aq-modal-row">
                    <span>Сумма</span>
                    <strong className="aq-modal-price">{modal.product.price} DMUSDT</strong>
                  </div>
                  <div className="aq-modal-row">
                    <span>Адрес</span>
                    <code className="aq-modal-addr">{modal.product.address}</code>
                  </div>
                </div>
                <button className="aq-modal-copy" onClick={() => {
                  navigator.clipboard.writeText(modal.product.address)
                  addLog('info', '📋 Адрес скопирован из модалки')
                }}>
                  📋 Копировать адрес
                </button>
                <p className="aq-modal-hint">
                  1. Открой MetaMask → Send<br />
                  2. Вставь адрес сверху<br />
                  3. Введи сумму: <strong>{modal.product.price} DMUSDT</strong><br />
                  4. Подтверди транзакцию
                </p>
                <button className="btn btn-secondary" onClick={closeModal}>Отмена</button>
              </>
            )}

            {modal.status === 'confirmed' && (
              <>
                <div className="aq-modal-icon">✅</div>
                <h2>Платёж подтверждён!</h2>
                <div className="aq-modal-details">
                  <div className="aq-modal-row">
                    <span>Платеж</span>
                    <strong>{modal.paymentId}</strong>
                  </div>
                  <div className="aq-modal-row">
                    <span>Товар</span>
                    <strong>{modal.product.name}</strong>
                  </div>
                  <div className="aq-modal-row">
                    <span>Сумма</span>
                    <strong className="aq-modal-price">{modal.product.price} DMUSDT</strong>
                  </div>
                  {modal.txHash && (
                    <div className="aq-modal-row">
                      <span>TX</span>
                      <a href={`https://sepolia.etherscan.io/tx/${modal.txHash}`}
                         target="_blank" rel="noreferrer" className="aq-modal-tx">
                        {modal.txHash.slice(0,10)}... ↗
                      </a>
                    </div>
                  )}
                </div>
                <button className="btn btn-primary" onClick={closeModal}>Готово</button>
              </>
            )}

            {modal.status === 'error' && (
              <>
                <div className="aq-modal-icon">❌</div>
                <h2>Таймаут платежа</h2>
                <p className="aq-modal-fail">Перевод не обнаружен в течение 3 минут</p>
                <button className="btn btn-primary" onClick={() => {
                  const p = modal.product
                  closeModal()
                  setTimeout(() => openPayment(p), 100)
                }}>
                  Попробовать снова
                </button>
                <button className="btn btn-secondary" style={{marginTop: 8}} onClick={closeModal}>Закрыть</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
