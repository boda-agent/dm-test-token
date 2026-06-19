import hre from 'hardhat'

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log('Деплоим с аккаунта:', deployer.address)

  const NeoToken = await hre.ethers.getContractFactory('NeoToken')
  const token = await NeoToken.deploy()
  await token.waitForDeployment()

  const addr = await token.getAddress()
  console.log('NeoToken задеплоен по адресу:', addr)
  console.log('Баланс деплоера:', await token.balanceOf(deployer.address))

  // Сохраняем адрес для фронтенда
  const fs = await import('fs')
  fs.writeFileSync('./src/contract-address.json', JSON.stringify({ address: addr }, null, 2))
  console.log('Адрес сохранен в src/contract-address.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
