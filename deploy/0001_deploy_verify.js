require("dotenv").config();
const { Contract, providers, Wallet } = require("ethers");
const { deployments, ethers, artifacts } = require("hardhat");
const {
  etherUnsigned,
  freezeTime,
  encodeParameters
} = require('../test/Ethereum');

const func = async function ({ deployments, getNamedAccounts, getChainId }) {
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const chnAddress = process.env.CHN_STAKING_ADDRESS;
  const poolIdStaking = process.env.POOl_ID_STAKING;
  const quorumVotes = process.env.QUORUM_VOTES;
  const proposalThreshold = process.env.PROPOSAL_THRESHOLD;
  const proposalMaxOperations = process.env.PROPOSAL_MAXOPERATIONS;
  const votingDelay = process.env.VOTING_DELAY;
  const votingPeriod = process.env.VOTING_PERIOD;
  const timelockDelay = process.env.TIMELOCK_DELAY;
  const provider = new providers.JsonRpcProvider(process.env.RPC_URL);

  console.log( {deployer} );
  
  const timelock = await deploy("CHNTimelock", {
    from: deployer,
    args: [deployer, timelockDelay],
    log: true,
  });

  const governance = await deploy("CHNGovernance", {
    from: deployer,
    args: [timelock.address, chnAddress, 0, deployer, [quorumVotes, proposalThreshold, proposalMaxOperations, votingDelay, votingPeriod]],
    log: true,
  });

  console.log(timelock.address);
  console.log(governance.address);

  const timelockABI = [
    "function queueTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) external returns (bytes32)"
  ];

  const target = timelock.address;
  const value = 0;
  const signature = "setPendingAdmin(address)";
  const data = encodeParameters(['address'], [governance.address]);
  const eta = Math.floor((new Date()).getTime() / 1000) + timelockDelay + 1000;

  const admin = new Wallet(process.env.ACC_PRIVATE_KEY, provider);

  console.log(target, value, signature, data, eta);
  const timelockContract = new Contract(timelock.address, timelockABI, provider);
  const setPendingHash = await timelockContract.connect(admin).queueTransaction(target, value, signature, data, eta, {gasLimit: 400000});
  await setPendingHash.wait();

  await sleep(30000);

  try {
    await hre.run('verify:verify', {
      address: timelock.address,
      constructorArguments: [deployer, timelockDelay],
    })
  } catch {

  }

  try {
    await hre.run('verify:verify', {
      address: governance.address,
      constructorArguments: [timelock.address, chnAddress, 0, deployer, [quorumVotes, proposalThreshold, proposalMaxOperations, votingDelay, votingPeriod]],
    })
  } catch {

  }
};

module.exports = func;

module.exports.tags = ['deploy-verify'];


async function sleep(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}