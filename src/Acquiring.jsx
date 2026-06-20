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
  { id: 1, name: '🎧 Наушники', price: 50 },
  { id: 2, name: '👟 Кроссовки', price: 120 },
  { id: 3, name: '⌚ Часы', price: 250 },
  { id: 4, name: '📱 Чехол', price: 15 },
]

export default function Acquiring({ onBack }) {
  const [logs, setLogs] = useState([])
  const [merchantBalance, setMerchantBalance] = useState(null)
  const [modal, setModal] = useState(null) // { product, status, txHash, paymentId }
  const logsEndRef = useRef(null)
  const intervalRef = useRef(null)

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

  // Загружаем баланс при монтировании
  useEffect(() => { fetchBalance() }, [fetchBalance])

  const openPayment = async (product) => {
    const paymentId = `PAY-${Date.now().toString(36).toUpperCase()}`
    setModal({ product, status: 'pending', paymentId })

    addLog('info', `🆕 Платеж #${paymentId}`)
    addLog('info', `🟢 Товар: ${product.name} | Сумма: ${product.price} DMUSDT`)
    addLog('info', `🏦 Кошелек мерчанта: ${MERCHANT_ADDR.slice(0,6)}...${MERCHANT_ADDR.slice(-4)}`)

    const provider = new JsonRpcProvider(RPC_URL)
    const contract = new Contract(CONTRACT_ADDR, TOKEN_ABI, provider)

    const before = await contract.balanceOf(MERCHANT_ADDR)
    const targetWei = BigInt(product.price) * 10n ** 18n
    addLog('pending', `⏳ Баланс мерчанта до: ${Number(formatEther(before)).toFixed(2)} DMUSDT`)
    addLog('pending', `⏳ Ожидаем перевод ${product.price} DMUSDT...`)

    // Опрос каждые 2 сек
    let pollCount = 0
    intervalRef.current = setInterval(async () => {
      pollCount++
      try {
        const current = await contract.balanceOf(MERCHANT_ADDR)
        const diff = current - before

        if (diff >= targetWei) {
          clearInterval(intervalRef.current)

          // Ищем Transfer event
          let txHash = ''
          try {
            const block = await provider.getBlockNumber()
            const events = await contract.queryFilter(
              contract.filters.Transfer(null, MERCHANT_ADDR),
              block - 30,
              'latest'
            )
            const match = events.find(e => e.args.value >= targetWei &&
              Number(e.args.value) / 10**18 === product.price)
            if (match) txHash = match.transactionHash
          } catch {}

          setModal({ product, status: 'confirmed', paymentId, txHash })
          setMerchantBalance(formatEther(current))
          addLog('success', `✅ Платеж #${paymentId} получен! ${product.price} DMUSDT`)
          addLog('success', `💰 Баланс мерчанта: ${Number(formatEther(current)).toFixed(2)} DMUSDT`)
          if (txHash) addLog('info', `🔗 TX: ${txHash.slice(0,10)}...${txHash.slice(-6)}`)
        } else if (pollCount > 60) {
          // 2 минуты прошло — таймаут
          clearInterval(intervalRef.current)
          setModal({ product, status: 'error', paymentId })
          addLog('error', `❌ Таймаут платежа #${paymentId}`)
        }
      } catch {}
    }, 2000)
  }

  const closeModal = () => {
    setModal(null)
    clearInterval(intervalRef.current)
  }

  return (
    <div className="acquiring">
      <header className="aq-header">
        <button className="btn btn-secondary aq-back" onClick={onBack}>← Назад</button>
        <h1>🧪 Тестовый эквайринг DMUSDT</h1>
        <p className="aq-subtitle">Нажми "Оплатить" — получи адрес и сумму для перевода. Система сама найдет платеж</p>
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
                <span>Адрес:</span>
                <code className="aq-merchant-code">{MERCHANT_ADDR.slice(0,10)}...{MERCHANT_ADDR.slice(-8)}</code>
                <button className="btn btn-small btn-secondary" onClick={() => {
                  navigator.clipboard.writeText(MERCHANT_ADDR)
                  addLog('info', '📋 Адрес скопирован')
                }}>📋</button>
              </div>
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
                  <p className="aq-hint">Система сгенерирует платеж и будет отслеживать перевод</p>
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
            <p>🔗 <strong>Контракт:</strong> <code>{CONTRACT_ADDR.slice(0,14)}...{CONTRACT_ADDR.slice(-4)}</code></p>
            <p>🌐 <strong>Сеть:</strong> Sepolia (11155111)</p>
          </div>
        </div>
      </div>

      {/* Модалка оплаты */}
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
                    <code className="aq-modal-addr">{MERCHANT_ADDR}</code>
                  </div>
                </div>
                <button className="aq-modal-copy" onClick={() => {
                  navigator.clipboard.writeText(MERCHANT_ADDR)
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
                <p className="aq-modal-fail">Перевод не обнаружен в течение 2 минут</p>
                <button className="btn btn-primary" onClick={() => {
                  closeModal()
                  openPayment(modal.product)
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
