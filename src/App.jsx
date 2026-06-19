import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider, Contract, formatEther, parseEther, JsonRpcSigner } from 'ethers'
import './App.css'

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
]

const NETWORK_CONFIG = {
  chainId: '0x7a69',   // 31337 — Hardhat
  chainName: 'Hardhat Local',
  rpcUrls: ['http://127.0.0.1:8545'],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
}

export default function App() {
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [account, setAccount] = useState(null)
  const [contract, setContract] = useState(null)
  const [tokenData, setTokenData] = useState(null)
  const [balance, setBalance] = useState(null)
  const [ethBalance, setEthBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [txStatus, setTxStatus] = useState(null)

  // Send form
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')

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

  // MINT
  const mintTokens = async () => {
    if (!contract) return
    try {
      setLoading(true)
      setTxStatus('⏳ Минтим токены...')

      const tx = await contract.mint()
      setTxStatus('⏳ Транзакция отправлена. Ждем подтверждения...')
      await tx.wait()

      setTxStatus('✅ Токены наминчены! Обновляем баланс...')
      const bal = await contract.balanceOf(account)
      setBalance(formatEther(bal))
      setTxStatus('✅ Успешно! +1000 DMUSDT на твой кошелек')
    } catch (err) {
      console.error(err)
      setTxStatus('❌ Ошибка минта: ' + (err.message || err))
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
      setTxStatus('⏳ Отправляем токены...')

      const tx = await contract.transfer(sendTo, parseEther(sendAmount))
      setTxStatus('⏳ Транзакция отправлена. Ждем подтверждения...')
      await tx.wait()

      setTxStatus(`✅ ${sendAmount} DMUSDT отправлено на ${sendTo.slice(0, 6)}...${sendTo.slice(-4)}`)

      const bal = await contract.balanceOf(account)
      setBalance(formatEther(bal))

      setSendTo('')
      setSendAmount('')
    } catch (err) {
      console.error(err)
      setTxStatus('❌ Ошибка отправки: ' + (err.message || err))
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

  return (
    <div className="app">
      {/* Hero */}
      <header className="hero">
        <div className="glow" />
        <h1 className="title">💎 DMUSDT</h1>
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
              {/* MINT */}
              <section className="card action-card">
                <h2>🏭 Mint Tokens</h2>
                <p className="desc">Получи 1000 DMUSDT токенов одним кликом</p>
                <button className="btn btn-accent" onClick={mintTokens} disabled={loading}>
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
                Запусти Hardhat node и задеплой контракт, затем обнови страницу.
              </p>
            </section>
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
            <strong>Установи Hardhat и запусти локальную ноду</strong>
            <pre className="code-block">npm run chain</pre>
            <span className="hint">Запустит локальный Ethereum-ноду на порту 8545</span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">2</div>
          <div>
            <strong>Задеплой контракт</strong>
            <pre className="code-block">npm run deploy</pre>
            <span className="hint">Скомпилирует и загрузит DMUSDT на локальную ноду</span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">3</div>
          <div>
            <strong>Скопируй приватные ключи из Hardhat</strong>
            <span className="hint">
              При запуске ноды Hardhat выдает тестовые аккаунты с ETH. Скопируй приватный ключ любого в MetaMask → Import Account.
            </span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">4</div>
          <div>
            <strong>Добавь Hardhat Network в MetaMask</strong>
            <pre className="code-block">
              Network Name: Hardhat Local{'\n'}
              RPC URL: http://127.0.0.1:8545{'\n'}
              Chain ID: 31337{'\n'}
              Currency Symbol: ETH
            </pre>
            <span className="hint">MetaMask → Settings → Networks → Add Network</span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">5</div>
          <div>
            <strong>Настрой ngrok (чтобы показать друзьям)</strong>
            <pre className="code-block">
              # Терминал 1 — нода{'\n'}
              npm run chain{'\n'}
              {'\n'}
              # Терминал 2 — деплой{'\n'}
              npm run deploy{'\n'}
              {'\n'}
              # Терминал 2 — фронт{'\n'}
              npm run dev{'\n'}
              {'\n'}
              # Терминал 3 — ngrok для фронта{'\n'}
              ngrok http 5173{'\n'}
              {'\n'}
              # Терминал 4 — ngrok для ноды (чтоб MetaMask мог подключиться){'\n'}
              ngrok http 8545
            </pre>
            <span className="hint">
              После ngrok замени RPC URL в MetaMask на ngrok-адрес и обнови фронт
            </span>
          </div>
        </div>

        <div className="step">
          <div className="step-num">6</div>
          <div>
            <strong>Открой сайт и пользуйся</strong>
            <ul className="feature-list">
              <li>🟢 Connect Wallet — подключи MetaMask</li>
              <li>🪙 Mint — получи 1000 DMUSDT</li>
              <li>📥 Add to MetaMask — токен появится в кошельке</li>
              <li>✈️ Send — отправь другу</li>
              <li>🔄 Друг делает Mint → у него тоже DMUSDT → отправляет обратно</li>
            </ul>
          </div>
        </div>

        <div className="step">
          <div className="step-num">7</div>
          <div>
            <strong>🎉 Гоняй токены между кошельками</strong>
            <span className="hint">
              Открой сайт на двух вкладках с разными аккаунтами (MetaMask → Switch Account). Mint на обоих и отправляй друг другу. Всё работает локально.
            </span>
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
