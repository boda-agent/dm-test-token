import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { BrowserProvider, Contract, formatEther, parseEther, JsonRpcSigner } from 'ethers'
import './App.css'
import Docs from './Docs.jsx'

// ABI для DMUSDT
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function mint() external',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function tokenInfo() view returns (string name, string symbol, uint8 decimals)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

const NETWORK_CONFIG = {
  chainId: '0xaa36a7',  // 11155111 — Sepolia
  chainName: 'Sepolia Testnet',
  rpcUrls: ['https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka'],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
}

export default function App() {
  const [page, setPage] = useState('main')
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState(null)
  const [contract, setContract] = useState(null)
  const [tokenData, setTokenData] = useState(null)
  const [balance, setBalance] = useState(null)
  const [ethBalance, setEthBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState(null)
  const progressRef = useRef(null)

  // Send form
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')

  // TX stages
  const TX_STAGES = useMemo(() => [
    { key: 'pending', label: '⏳ Pending', percent: 20 },
    { key: 'confirmed', label: '✅ Confirmed', percent: 70 },
    { key: 'success', label: '🎉 Success', percent: 100 },
  ], [])
  const [currentStage, setCurrentStage] = useState(null)
  const [stageIndex, setStageIndex] = useState(0)

  const contractAddress = null // будет загружен из JSON

  // Загружаем адрес контракта
  const getContractAddress = useCallback(async () => {
    try {
      const resp = await fetch('/contract-address.json')
      if (!resp.ok) throw new Error('Файл не найден')
      const data = await resp.json()
      return data.address
    } catch {
      return null
    }
  }, [])

  // Подключение к MetaMask
  const connectWallet = async () => {
    if (!window.ethereum) {
      setTxStatus('❌ MetaMask не установлен. Установи расширение MetaMask.')
      return
    }
    try {
      setLoading(true)
      setTxStatus(null)

      // Переключаемся на Hardhat Network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NETWORK_CONFIG.chainId }],
        })
      } catch (switchErr) {
        // Код 4902 = цепь не добавлена
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK_CONFIG],
          })
        } else if (switchErr.code !== 4001) {
          throw switchErr
        }
      }

      const prov = new BrowserProvider(window.ethereum)
      const sign = await prov.getSigner()
      const addr = await sign.getAddress()

      setProvider(prov)
      setSigner(sign)
      setAccount(addr)

      // Получаем ETH баланс
      const ethBal = await prov.getBalance(addr)
      setEthBalance(formatEther(ethBal))

      // Подключаем контракт
      const cAddr = await getContractAddress()
      if (cAddr) {
        const c = new Contract(cAddr, TOKEN_ABI, sign)
        setContract(c)

        const [name, symbol, decimals] = await c.tokenInfo()
        setTokenData({ name, symbol, decimals })

        const bal = await c.balanceOf(addr)
        setBalance(formatEther(bal))
      } else {
        setTxStatus('⚠️ Контракт не задеплоен. Запусти localhost ноду и задеплой.')
      }

      setTxStatus('✅ Кошелек подключен')
    } catch (err) {
      console.error(err)
      setTxStatus('❌ Ошибка подключения: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Утилита: запустить прогресс с этапами
  const startProgress = () => {
    setStageIndex(0)
    setCurrentStage(TX_STAGES[0])
    clearInterval(progressRef.current)
    progressRef.current = setInterval(() => {
      setStageIndex(prev => {
        const next = prev + 1
        if (next < TX_STAGES.length) {
          setCurrentStage(TX_STAGES[next])
        }
        clearInterval(progressRef.current)
        return Math.min(next, TX_STAGES.length - 1)
      })
    }, 12000) // ~12 сек на этап
  }

  const completeProgress = () => {
    clearInterval(progressRef.current)
    setStageIndex(TX_STAGES.length - 1)
    setCurrentStage(TX_STAGES[TX_STAGES.length - 1])
    setTimeout(() => {
      setCurrentStage(null)
      setStageIndex(0)
    }, 3000)
  }

  const failProgress = () => {
    clearInterval(progressRef.current)
    setCurrentStage(null)
    setStageIndex(0)
  }

  // MINT
  const mintTokens = async () => {
    if (!contract) return
    try {
      setLoading(true)
      setTxStatus(null)
      startProgress()

      setTxStatus('⏳ Отправка транзакции минта...')
      const tx = await contract.mint()

      setTxStatus('⏳ Транзакция отправлена. Ожидание подтверждения...')
      // Ждём первый блок
      await tx.wait()

      setTxStatus('✅ Транзакция подтверждена! Обновляем баланс...')
      const bal = await contract.balanceOf(account)
      setBalance(formatEther(bal))
      setTxStatus('✅ Успешно! +1000 DMUSDT на твой кошелек')
      completeProgress()
    } catch (err) {
      console.error(err)
      setTxStatus('❌ Ошибка минта: ' + (err.message || err))
      failProgress()
    } finally {
      setLoading(false)
    }
  }

  // Добавить токен в MetaMask
  const addToMetaMask = async () => {
    if (!contract || !tokenData) {
      setTxStatus('⚠️ Сначала подключи кошелек')
      return
    }
    try {
      setTxStatus('⏳ Добавляем токен в MetaMask...')
      const cAddr = await getContractAddress()
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: cAddr,
            symbol: tokenData.symbol,
            decimals: Number(tokenData.decimals),
            image: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons/svg/color/eth.svg',
          },
        },
      })
      setTxStatus('✅ Токен добавлен в MetaMask!')
    } catch (err) {
      console.error(err)
      setTxStatus('⚠️ Отменено или ошибка: ' + (err.message || err))
    }
  }

  // SEND tokens
  const sendTokens = async () => {
    if (!contract || !sendTo || !sendAmount) {
      setTxStatus('⚠️ Заполни адрес и количество')
      return
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(sendTo)) {
      setTxStatus('❌ Неверный адрес кошелька')
      return
    }
    try {
      setLoading(true)
      setTxStatus(null)
      startProgress()

      setTxStatus('⏳ Отправляем токены...')
      const tx = await contract.transfer(sendTo, parseEther(sendAmount))

      setTxStatus('⏳ Транзакция отправлена. Ожидание подтверждения...')
      await tx.wait()

      setTxStatus(`✅ ${sendAmount} DMUSDT отправлено на ${sendTo.slice(0, 6)}...${sendTo.slice(-4)}`)

      const bal = await contract.balanceOf(account)
      setBalance(formatEther(bal))

      setSendTo('')
      setSendAmount('')
      completeProgress()
    } catch (err) {
      console.error(err)
      setTxStatus('❌ Ошибка отправки: ' + (err.message || err))
      failProgress()
    } finally {
      setLoading(false)
    }
  }

  // Claim & Mint (прогресс теперь через TX_STAGES)
  const claimAndMint = async () => {
    if (!account) {
      setTxStatus('⚠️ Сначала подключи кошелек')
      return
    }
    try {
      setLoading(true)
      setTxStatus(null)
      startProgress()

      setTxStatus('⏳ Запуск транзакции...')
      const resp = await fetch('/api/claim-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Ошибка сервера')
      }

      setTxStatus(`✅ Получено ${data.ethAmount} SepoliaETH + ${data.tokenAmount} DMUSDT!`)

      if (contract) {
        const bal = await contract.balanceOf(account)
        setBalance(formatEther(bal))
        const eth = await provider.getBalance(account)
        setEthBalance(formatEther(eth))
      }

      completeProgress()
    } catch (err) {
      console.error(err)
      setTxStatus('❌ ' + (err.message || err))
      failProgress()
    } finally {
      setLoading(false)
    }
  }

  // Обновление баланса по таймеру
  useEffect(() => {
    if (!contract || !account) return
    const interval = setInterval(async () => {
      try {
        const bal = await contract.balanceOf(account)
        setBalance(formatEther(bal))
        if (provider) {
          const eth = await provider.getBalance(account)
          setEthBalance(formatEther(eth))
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [contract, account, provider])

  // Авто-подключение при загрузке (если MetaMask уже подключен)
  useEffect(() => {
    if (window.ethereum && window.ethereum.selectedAddress) {
      connectWallet()
    }
  }, [])

  // Слушаем смену аккаунта
  useEffect(() => {
    if (!window.ethereum) return
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount(null)
        setSigner(null)
        setContract(null)
        setBalance(null)
        setEthBalance(null)
        setTxStatus('👋 Кошелек отключен')
      } else {
        connectWallet()
      }
    }
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
  }, [])

  const shortAddr = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : ''

  if (page !== 'main') {
    return <Docs onBack={() => setPage('main')} />
  }

  return (
    <div className="app">
      {/* Hero */}
      <header className="hero">
        <div className="glow" />
        <div className="hero-top">
          <h1 className="title">💎 DMUSDT</h1>
          <button className="btn btn-docs" onClick={() => setPage('docs')}>
            📄 Документация
          </button>
        </div>
        <p className="subtitle">Mint, Send & Add to MetaMask</p>
      </header>

      {/* Wallet Connection */}
      <section className="card wallet-card">
        {!account ? (
          <button className="btn btn-primary" onClick={connectWallet} disabled={loading}>
            {loading ? '⏳ Подключение...' : '🔌 Connect Wallet'}
          </button>
        ) : (
          <div className="wallet-info">
            <div className="badge connected">✅ Connected</div>
            <div className="address">{shortAddr}</div>
            <div className="balances">
              <span>Ξ {ethBalance ? Number(ethBalance).toFixed(4) : '...'} ETH</span>
              {balance !== null && (
                <span className="token-balance">
                  {tokenData?.symbol} {Number(balance).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {account && (
        <>
          {/* Token Info & Actions */}
          {contract ? (
            <>
              {/* CLAIM & MINT — бесплатно */}
              <section className="card action-card" style={{border: '2px solid #00e676'}}>
                <h2>🚀 Claim & Mint</h2>
                <p className="desc">Получи Sepolia ETH + 1000 DMUSDT за один клик. Газ оплачен 🎁</p>
                <button className="btn btn-accent" onClick={claimAndMint} disabled={loading}>
                  {loading ? '⏳' : '🚀 Claim ETH + Mint 1000 DMUSDT'}
                </button>
              </section>

              {/* MINT (для тех у кого уже есть ETH) */}
              <section className="card action-card">
                <h2>🏭 Mint Tokens</h2>
                <p className="desc">Если у тебя уже есть Sepolia ETH — минти сам</p>
                <button className="btn btn-secondary" onClick={mintTokens} disabled={loading}>
                  {loading ? '⏳' : '🪙 Mint 1000 DMUSDT'}
                </button>
              </section>

              {/* Add to MetaMask */}
              <section className="card action-card">
                <h2>📥 Add to MetaMask</h2>
                <p className="desc">Добавь токен в кошелек, чтобы видеть баланс</p>
                <button className="btn btn-secondary" onClick={addToMetaMask}>
                  ➕ Add DMUSDT to Wallet
                </button>
              </section>

              {/* SEND */}
              <section className="card action-card">
                <h2>✈️ Send Tokens</h2>
                <p className="desc">Перешли токены на другой кошелек</p>
                <div className="send-form">
                  <input
                    type="text"
                    placeholder="Адрес кошелька (0x...)"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Количество DMUSDT"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="input"
                  />
                  <button className="btn btn-primary" onClick={sendTokens} disabled={loading}>
                    {loading ? '⏳' : '✈️ Send'}
                  </button>
                </div>
              </section>
            </>
          ) : (
            <section className="card action-card">
              <h2>⚠️ Контракт не найден</h2>
              <p className="desc">
                Контракт еще не задеплоен. Обнови страницу после деплоя.
              </p>
            </section>
          )}

          {/* Loader / Progress с этапами */}
          {loading && currentStage && (
            <div className="progress-wrapper">
              {/* Этапы прогресса */}
              <div className="progress-stages">
                {TX_STAGES.map((stage, i) => (
                  <div
                    key={stage.key}
                    className={`progress-stage ${stageIndex >= i ? 'active' : ''} ${stageIndex > i ? 'done' : ''}`}
                  >
                    <div className="stage-dot">
                      {stageIndex > i ? '✓' : stageIndex === i ? '●' : '○'}
                    </div>
                    <span className="stage-label">{stage.label.split(' ')[1] || stage.label}</span>
                  </div>
                ))}
              </div>
              {/* Прогресс-бар */}
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${TX_STAGES[stageIndex]?.percent || 0}%` }}
                ></div>
              </div>
              <div className="progress-info">
                <div className="spinner"></div>
                <span>⏳ Транзакция занимает 20-60 секунд. Пожалуйста, подожди.</span>
              </div>
            </div>
          )}

          {/* Status */}
          {txStatus && (
            <div className={`status-bar ${txStatus.startsWith('✅') ? 'success' : txStatus.startsWith('❌') ? 'error' : ''}`}>
              {txStatus}
            </div>
          )}
        </>
      )}

      {/* Instructions */}
      <section className="card instructions-card">
        <h2>📖 Как это работает</h2>

        <div className="step">
          <div className="step-num">1</div>
          <div>
            <strong>Добавь Sepolia Testnet в MetaMask</strong>
            <pre className="code-block">{'{\n'}  "Network Name": "Sepolia Testnet",{'\n'}  "RPC URL": "https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka",{'\n'}  "Chain ID": 11155111,{'\n'}  "Currency Symbol": "ETH"{'\n}'}</pre>
            <span className="hint">MetaMask → Settings → Networks → Add Network</span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">2</div>
          <div>
            <strong>Импортируй тестовый аккаунт</strong>
            <span className="hint">
              Приватный ключ: <code>0x1cd9013a3a4deb16158293a549fa554515eb6be71402d5486baf0727b35b442e</code>
              (на этом кошельке уже есть Sepolia ETH и задеплоен контракт)
            </span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">3</div>
          <div>
            <strong>Импортируй второй аккаунт (для теста)</strong>
            <span className="hint">
              Открой другой браузер или используй Incognito, создай новый MetaMask кошелек и получи Sepolia ETH на https://sepolia-faucet.pk910.de чтобы платить за газ при минте
            </span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">4</div>
          <div>
            <strong>Открой сайт и пользуйся</strong>
            <ul className="feature-list">
              <li>🟢 Connect Wallet — подключи MetaMask (сеть Sepolia)</li>
              <li>🪙 Mint — получи 1000 DMUSDT</li>
              <li>📥 Add to MetaMask — токен появится в кошельке</li>
              <li>✈️ Send — отправь другу</li>
              <li>🔄 Друг делает Mint → у него тоже DMUSDT → отправляет обратно</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Made with 💎 by Neo · 2026</p>
      </footer>
    </div>
  )
}
