// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DMUSDT is ERC20, Ownable {
    uint256 public constant MINT_AMOUNT = 1000 * 10 ** 18; // 1000 токенов за минт

    constructor() ERC20("DM USDT", "DMUSDT") Ownable(msg.sender) {
        // Милтим 10000 токенов создателю при деплое
        _mint(msg.sender, 10000 * 10 ** 18);
    }

    // Публичный минт — любой может накликать себе 1000 токенов (для теста)
    function mint() external {
        _mint(msg.sender, MINT_AMOUNT);
    }

    // Спонсорский минт — владелец контракта может минтить на любой адрес
    // (газ платит владелец, токены получает to)
    function sponsorMint(address to) external onlyOwner {
        _mint(to, MINT_AMOUNT);
    }

    // Функция для удобного добавления в MetaMask — даем инфу о токене
    function tokenInfo() external pure returns (string memory name, string memory symbol, uint8 decimals) {
        return ("DM USDT", "DMUSDT", 18);
    }
}
