require("dotenv").config();
const { deployments, ethers, artifacts } = require("hardhat");

const func = async function ({ deployments, getNamedAccounts, getChainId }) {
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log( {deployer} );
  
  const token = await deploy("FakeToken", {
    from: deployer,
    args: ['10000000000000000000000000'],
    log: true,
  });

  await sleep(30000);

  await hre.run('verify:verify', {
    address: token.address,
    constructorArguments: ['10000000000000000000000000'],
  })
};

module.exports = func;

module.exports.tags = ['deploy-token-verify'];


async function sleep(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}