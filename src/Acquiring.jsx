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
  { id: 1, name: '🎧 Наушники', price: 50, emoji: '🎧' },
  { id: 2, name: '👟 Кроссовки', price: 120, emoji: '👟' },
  { id: 3, name: '⌚ Часы', price: 250, emoji: '⌚' },
  { id: 4, name: '📱 Чехол', price: 15, emoji: '📱' },
]

const MERCHANT_ADDRESS_LABEL = `${MERCHANT_ADDR.slice(0, 6)}...${MERCHANT_ADDR.slice(-4)}`

export default function Acquiring({ onBack }) {
  const [logs, setLogs] = useState([])
  const [merchantBalance, setMerchantBalance] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [status, setStatus] = useState('waiting') // waiting | pending | confirmed | error
  const [paymentTx, setPaymentTx] = useState(null)
  const prevBalanceRef = useRef(null)
  const logsEndRef = useRef(null)
  const intervalRef = useRef(null)

  const addLog = (type, msg) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { time, type, msg }])
  }

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Загрузка начального баланса мерчанта
  const fetchMerchantBalance = useCallback(async () => {
    try {
      const provider = new JsonRpcProvider(RPC_URL)
      const contract = new Contract(CONTRACT_ADDR, TOKEN_ABI, provider)
      const bal = await contract.balanceOf(MERCHANT_ADDR)
      const formatted = formatEther(bal)
      setMerchantBalance(formatted)
      prevBalanceRef.current = bal
      return bal
    } catch (e) {
      return null
    }
  }, [])

  // Старт отслеживания оплаты
  const startPayment = async (product) => {
    setSelectedProduct(product)
    setPaymentTx(null)
    setStatus('pending')

    const provider = new JsonRpcProvider(RPC_URL)
    const contract = new Contract(CONTRACT_ADDR, TOKEN_ABI, provider)

    const before = await fetchMerchantBalance()
    addLog('info', `🟢 Запрос на оплату: ${product.name} — ${product.price} DMUSDT`)
    addLog('info', `🏦 Адрес мерчанта: ${MERCHANT_ADDRESS_LABEL}`)
    addLog('info', `💰 Баланс мерчанта до: ${Number(before).toFixed(2)} DMUSDT`)
    addLog('pending', `⏳ Ожидаем перевод ${product.price} DMUSDT на адрес мерчанта...`)
    addLog('info', `📋 Отправь DMUSDT через MetaMask на адрес ниже`)

    // Опрос баланса каждые 3 секунды
    const targetWei = product.price * 10n ** 18n
    intervalRef.current = setInterval(async () => {
      try {
        const current = await contract.balanceOf(MERCHANT_ADDR)
        const diff = current - before

        if (diff >= targetWei) {
          clearInterval(intervalRef.current)
          setStatus('confirmed')
          setMerchantBalance(formatEther(current))

          // Ищем транзакцию Transfer в последних блоках
          try {
            const block = await provider.getBlockNumber()
            const events = await contract.queryFilter(
              contract.filters.Transfer(null, MERCHANT_ADDR),
              block - 20,
              'latest'
            )
            const match = events.find(e => e.args.value >= targetWei)
            if (match) {
              setPaymentTx(match.transactionHash)
            }
          } catch {}

          addLog('success', `✅ Платёж получен! +${Number(formatEther(diff)).toFixed(2)} DMUSDT`)
          addLog('success', `💰 Баланс мерчанта: ${Number(formatEther(current)).toFixed(2)} DMUSDT`)
          addLog('info', '📊 Транзакция завершена успешно')
        }
      } catch {}
    }, 3000)
  }

  // Остановка отслеживания при уходе
  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  return (
    <div className="acquiring">
      <header className="aq-header">
        <button className="btn btn-secondary aq-back" onClick={onBack}>← Назад</button>
        <h1>🧪 Тестовый эквайринг DMUSDT</h1>
        <p className="aq-subtitle">Отправь DMUSDT на адрес мерчанта — система сама обнаружит платеж</p>
      </header>

      <div className="aq-split">
        {/* Левая панель: магазин + адрес */}
        <div className="aq-store">
          {/* Адрес для перевода */}
          <div className="aq-card aq-address-card">
            <h2>📤 Отправить DMUSDT на адрес</h2>
            <div className="aq-address-block">
              <code className="aq-address">{MERCHANT_ADDR}</code>
              <button className="btn btn-small btn-primary" onClick={() => {
                navigator.clipboard.writeText(MERCHANT_ADDR)
                addLog('info', '📋 Адрес мерчанта скопирован')
              }}>
                📋 Копировать
              </button>
            </div>
            <p className="aq-address-hint">
              Открой MetaMask → Send → вставь этот адрес → отправь нужное количество DMUSDT
            </p>
            <div className="aq-merchant-balance">
              <span>🏦 Баланс мерчанта:</span>
              <span className="aq-balance-big">{merchantBalance !== null ? Number(merchantBalance).toFixed(2) : <span className="spinner-sm" />} DMUSDT</span>
              <button className="btn btn-small btn-secondary" onClick={() => {
                fetchMerchantBalance()
                addLog('info', '🔄 Баланс обновлен')
              }}>
                Обновить
              </button>
            </div>
          </div>

          {/* Товары */}
          <div className="aq-card">
            <h2>🏪 Товары</h2>
            <p className="aq-products-hint">Выбери товар — скопируй сумму для отправки</p>
            <div className="aq-products">
              {PRODUCTS.map(p => (
                <div key={p.id} className={`aq-product ${selectedProduct?.id === p.id ? 'selected' : ''}`}>
                  <div className="aq-product-info">
                    <span className="aq-product-name">{p.emoji} {p.name}</span>
                    <span className="aq-product-price">{p.price} DMUSDT</span>
                  </div>
                  <div className="aq-product-actions">
                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => startPayment(p)}
                      disabled={status === 'pending'}
                    >
                      {status === 'pending' && selectedProduct?.id === p.id ? '⏳...' : 'Оплатить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {status === 'pending' && (
              <div className="aq-paying">
                <div className="spinner"></div>
                <span>Ожидание перевода на адрес мерчанта...</span>
              </div>
            )}

            {status === 'confirmed' && (
              <div className="aq-confirmed">
                <span className="aq-check">✅</span>
                <div>
                  <strong>Платёж подтверждён!</strong>
                  {paymentTx && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${paymentTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="aq-tx-link"
                    >
                      Посмотреть в Etherscan ↗
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Правая панель: логи */}
        <div className="aq-logs-panel">
          <div className="aq-card aq-logs-card">
            <h2>📋 Логи эквайринга</h2>
            <div className="aq-logs">
              {logs.length === 0 ? (
                <div className="aq-logs-empty">
                  <p>Нажми "Оплатить" на любом товаре</p>
                  <p className="aq-hint">Система будет отслеживать перевод на адрес мерчанта</p>
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
            <p>🏦 <strong>Мерчант:</strong> <code>{MERCHANT_ADDRESS_LABEL}</code></p>
            <p>🌐 <strong>Сеть:</strong> Sepolia (Chain ID: 11155111)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
