const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log('Деплоим с аккаунта:', deployer.address)

  const DMUSDT = await hre.ethers.getContractFactory('DMUSDT')
  const token = await DMUSDT.deploy()
  await token.waitForDeployment()

  const addr = await token.getAddress()
  console.log('DMUSDT задеплоен по адресу:', addr)
  console.log('Баланс деплоера:', await token.balanceOf(deployer.address))

  // Сохраняем адрес для фронтенда
  const dest = path.join(__dirname, '..', 'public', 'contract-address.json')
  fs.writeFileSync(dest, JSON.stringify({ address: addr }, null, 2))
  console.log('Адрес сохранен в', dest)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
