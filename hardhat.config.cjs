require('@nomicfoundation/hardhat-toolbox')

/** @type {import('hardhat/config').HardhatUserConfig} */
const PRIVATE_KEY = '0x1cd9013a3a4deb16158293a549fa554515eb6be71402d5486baf0727b35b442e'

const config = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    sepolia: {
      url: 'https://eth-sepolia.g.alchemy.com/v2/MMdh1t3D_tgjOOkQK69Ka',
      accounts: [PRIVATE_KEY],
    },
  },
}

module.exports = config
