import './Docs.css'

export default function Docs({ onBack }) {
  return (
    <div className="docs">
      <header className="docs-header">
        <button className="btn btn-secondary docs-back" onClick={onBack}>
          ← Назад
        </button>
        <div>
          <h1>📄 Документация DMUSDT</h1>
          <p className="docs-subtitle">Тестовый ERC20 токен на Sepolia testnet</p>
        </div>
      </header>

      {/* Overview */}
      <section className="docs-section">
        <h2>🔍 Что это?</h2>
        <p><strong>DMUSDT</strong> — тестовый ERC20 токен на сети <strong>Sepolia</strong> (Ethereum testnet).</p>
        <p>Предназначен для симуляции платежей в USDT при разработке и тестировании платежных шлюзов и кошельков.</p>
        <div className="docs-highlight">
          <strong>Адрес контракта:</strong> <code>0x6F765509c7D319b5760392dFf927557EF90d319C</code>
        </div>
        <div className="docs-highlight">
          <strong>Сеть:</strong> Sepolia (Chain ID: <code>11155111</code>)
        </div>
      </section>

      {/* Quick Start */}
      <section className="docs-section">
        <h2>🚀 Быстрый старт</h2>

        <h3>1. Добавь Sepolia в MetaMask</h3>
        <pre className="docs-code">
{`{
  "Network Name": "Sepolia Testnet",
  "RPC URL": "https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka",
  "Chain ID": 11155111,
  "Currency Symbol": "ETH"
}`}</pre>
        <p>Или через <a href="https://chainlist.org" target="_blank">chainlist.org</a> — найди Sepolia и Add Chain.</p>

        <h3>2. Добавь токен в кошелек</h3>
        <ul className="docs-list">
          <li>Открой сайт: <a href="https://token-landing-seven.vercel.app" target="_blank">token-landing-seven.vercel.app</a></li>
          <li>Connect Wallet</li>
          <li>Нажми <strong>➕ Add DMUSDT to Wallet</strong></li>
        </ul>
        <p className="docs-note">Или добавь вручную: Address <code>0x6F765509c7D319b5760392dFf927557EF90d319C</code>, Symbol <code>DMUSDT</code>, Decimals <code>18</code>.</p>

        <h3>3. Получи тестовые токены</h3>
        <ul className="docs-list">
          <li><strong>🚀 Claim ETH + Mint 1000 DMUSDT</strong> — нажми на сайте, получишь и ETH и токены бесплатно</li>
          <li>Или получи Sepolia ETH на <a href="https://sepolia-faucet.pk910.de" target="_blank">faucet</a> и нажми Mint сам</li>
        </ul>

        <h3>4. Адрес для тестовых платежей</h3>
        <p>Кошелек <strong>спонсора</strong> (на нем ETH для газа):</p>
        <pre className="docs-code">0xA72C11A8D266058Aa025969367124a2025E2085D</pre>
        <p className="docs-note">
          Если спонсорский ETH закончится — пополни через <a href="https://sepolia-faucet.pk910.de" target="_blank">faucet</a> с приватным ключом:
        </p>
        <pre className="docs-code">0x1cd9013a3a4deb16158293a549fa554515eb6be71402d5486baf0727b35b442e</pre>
      </section>

      {/* Integration */}
      <section className="docs-section">
        <h2>🔌 Интеграция (Solidity)</h2>
        <p>Как взаимодействовать с токеном из смарт-контракта:</p>
        <pre className="docs-code">{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDMUSDT {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract PaymentGateway {
    IDMUSDT public token =
        IDMUSDT(0x6F765509c7D319b5760392dFf927557EF90d319C);

    event PaymentReceived(address payer, uint256 amount);

    function pay(uint256 amount) external {
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        emit PaymentReceived(msg.sender, amount);
    }
}`}</pre>
      </section>

      <section className="docs-section">
        <h2>🌐 Интеграция (JavaScript / ethers.js)</h2>
        <pre className="docs-code">{`import { ethers } from 'ethers';

const DMUSDT_ADDRESS = '0x6F765509c7D319b5760392dFf927557EF90d319C';

const ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// Подключение
const provider = new ethers.JsonRpcProvider(
  'https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka'
);
const token = new ethers.Contract(DMUSDT_ADDRESS, ABI, provider);

// Проверка баланса
const balance = await token.balanceOf(walletAddress);
console.log('Баланс:', ethers.formatEther(balance), 'DMUSDT');

// Отправка
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const tx = await token.connect(signer).transfer(
  toAddress,
  ethers.parseEther('100')
);
await tx.wait();
console.log('Отправлено! TX:', tx.hash);`}</pre>
      </section>

      <section className="docs-section">
        <h2>🔬 Тестовые сценарии</h2>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Сценарий</th>
                <th>Действие</th>
                <th>Ожидаемый результат</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Пополнение баланса</td>
                <td>Перевести DMUSDT на адрес мерчанта</td>
                <td>Баланс мерчанта увеличивается</td>
              </tr>
              <tr>
                <td>Оплата заказа</td>
                <td>Вызвать transferFrom(покупатель, мерчант, сумма)</td>
                <td>Токены списаны с покупателя, зачислены мерчанту</td>
              </tr>
              <tr>
                <td>Возврат</td>
                <td>Обратный перевод DMUSDT от мерчанта покупателю</td>
                <td>Балансы восстановлены</td>
              </tr>
              <tr>
                <td>Недостаточно баланса</td>
                <td>Попытаться перевести больше чем есть</td>
                <td>Revert: ERC20InsufficientBalance</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Contract Reference */}
      <section className="docs-section">
        <h2>📜 Контракт (исходный код)</h2>
        <p>Полный код токена доступен на GitHub:</p>
        <a href="https://github.com/boda-agent/dm-test-token/blob/main/contracts/DMUSDT.sol" target="_blank" className="docs-link">
          github.com/boda-agent/dm-test-token
        </a>
        <p className="docs-mt">Функции контракта:</p>
        <ul className="docs-list">
          <li><code>mint()</code> — публичный минт 1000 DMUSDT (газ платит вызывающий)</li>
          <li><code>sponsorMint(address to)</code> — минт на любой адрес (только владелец, газ спонсора)</li>
          <li><code>transfer(to, amount)</code> — перевод токенов</li>
          <li><code>transferFrom(from, to, amount)</code> — перевод от имени (для approve)</li>
          <li><code>approve(spender, amount)</code> — разрешить трату токенов</li>
          <li><code>balanceOf(account)</code> — баланс</li>
          <li><code>tokenInfo()</code> — имя, символ, decimals</li>
        </ul>
      </section>

      {/* Explorer */}
      <section className="docs-section">
        <h2>🔗 Ссылки</h2>
        <ul className="docs-links">
          <li>🌐 Сайт: <a href="https://token-landing-seven.vercel.app" target="_blank">token-landing-seven.vercel.app</a></li>
          <li>📄 Etherscan: <a href="https://sepolia.etherscan.io/address/0x6F765509c7D319b5760392dFf927557EF90d319C" target="_blank">Sepolia Etherscan</a></li>
          <li>📦 GitHub: <a href="https://github.com/boda-agent/dm-test-token" target="_blank">boda-agent/dm-test-token</a></li>
          <li>⛽ Faucet: <a href="https://sepolia-faucet.pk910.de" target="_blank">sepolia-faucet.pk910.de</a></li>
        </ul>
      </section>

      <footer className="docs-footer">
        <button className="btn btn-primary" onClick={onBack}>
          ← Вернуться на главную
        </button>
      </footer>
    </div>
  )
}
