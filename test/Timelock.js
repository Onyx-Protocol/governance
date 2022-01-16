const FakeToken = artifacts.require('FakeToken');
const CHNGovernance = artifacts.require('CHNGovernance');
const CHNTimelock = artifacts.require('CHNTimelock');
const { default: BigNumber } = require('bignumber.js');
const { assert } = require('chai');
const { ethers, waffle } = require('hardhat');

const BN = web3.utils.BN;
const {
  etherUnsigned,
  freezeTime,
  encodeParameters
} = require('./Ethereum');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bn')(BN))
  .should();

contract('Timelock Contract', function (accounts) {
  let root = accounts[0];
  let a1 = accounts[1];
  let a2 = accounts[2];
  let newAdmin = accounts[3];
  let CHNToken;
  let timelock;

  const deplayPeriod = new BigNumber(3).times(24).times(60).times(60);
  const zero = new BigNumber(0);
  const gracePeriod = deplayPeriod.times(2);

  beforeEach(async () => {
    timelock = await CHNTimelock.new(root, deplayPeriod);
  });

  it('check constructor', async () => {
    await expectThrow(CHNTimelock.new(root, deplayPeriod.div(24), {from: root}), "Timelock::constructor: Delay must exceed minimum delay.");
    await expectThrow(CHNTimelock.new(root, deplayPeriod.times(24), {from: root}), "Timelock::setDelay: Delay must not exceed maximum delay.");
  });

  it('setDelay', async () => {
    const blockTime = await timelock.getBlockTimestamp();
    assertEqual(await timelock.delay(), deplayPeriod);
    const [target, value, signature, data, eta] = [
      timelock.address,
      zero,
      "setDelay(uint256)",
      encodeParameters(['uint256'], [deplayPeriod.times(2).toNumber()]),
      deplayPeriod.plus(blockTime).plus(2)
    ]
    await timelock.queueTransaction(target, value, signature, data, eta);
    const txQueues = await timelock.txQueues(0);
    assert(txQueues.signature, "setDelay(uint256)");
    const txHash = txQueues.txHash;
    
    assertEqual(await timelock.queuedTransactions(txHash), true);
    increaseTime(deplayPeriod.plus(10).toNumber());
    await timelock.executeTransactionWithID(0);
    assertEqual(await timelock.delay(), deplayPeriod.times(2));
    assertEqual(await timelock.queuedTransactions(txHash), false);
    await expectThrow(timelock.setDelay(100, {from: root}), "Timelock::setDelay: Call must come from Timelock.");
  });

  it('queueTx', async () => {
    const blockTime = await timelock.getBlockTimestamp();
    assertEqual(await timelock.delay(), deplayPeriod);
    const [target, value, signature, data, eta] = [
      timelock.address,
      zero,
      "setDelay(uint256)",
      encodeParameters(['uint256'], [deplayPeriod.times(2).toNumber()]),
      deplayPeriod.plus(blockTime).plus(2)
    ]
    await timelock.queueTransaction(target, value, signature, data, eta);
    const txQueues = await timelock.txQueues(0);
    assert(txQueues.signature, "setDelay(uint256)");

    const notValidETA = deplayPeriod.plus(blockTime).minus(1);
    await expectThrow(timelock.queueTransaction(target, value, signature, data, notValidETA), "Timelock::queueTransaction: Estimated execution block must satisfy delay.");
    await expectThrow(timelock.queueTransaction(target, value, signature, data, eta, {from: a1}), "Timelock::queueTransaction: Call must come from admin.");
  });

  it('cancel', async () => {
    const blockTime = await timelock.getBlockTimestamp();
    assertEqual(await timelock.delay(), deplayPeriod);
    const [target, value, signature, data, eta] = [
      timelock.address,
      zero,
      "setDelay(uint256)",
      encodeParameters(['uint256'], [deplayPeriod.times(2).toNumber()]),
      deplayPeriod.plus(blockTime).plus(2)
    ]
    await timelock.queueTransaction(target, value, signature, data, eta);
    const txQueues = await timelock.txQueues(0);
    assert(txQueues.signature, "setDelay(uint256)");
    const txHash = txQueues.txHash;
    assertEqual(await timelock.queuedTransactions(txHash), true);

    await expectThrow(timelock.cancelTransactionWithID(0, {from: a1}), "Timelock::cancelTransaction: Call must come from admin.");
    await timelock.cancelTransactionWithID(0);
    assertEqual(await timelock.queuedTransactions(txHash), false);

  });

  it('excute', async () => {
    const blockTime = await timelock.getBlockTimestamp();
    assertEqual(await timelock.delay(), deplayPeriod);
    const [target, value, signature, data1, data2, data3, eta] = [
      timelock.address,
      zero,
      "setDelay(uint256)",
      encodeParameters(['uint256'], [deplayPeriod.times(3).toNumber()]),
      encodeParameters(['uint256'], [deplayPeriod.times(2).toNumber()]),
      encodeParameters(['uint256'], [deplayPeriod.times(4).toNumber()]),
      deplayPeriod.plus(blockTime).plus(20)
    ]
    await timelock.queueTransaction(target, value, signature, data1, eta);
    const txQueues1 = await timelock.txQueues(0);
    const txHash1 = txQueues1.txHash;
    assertEqual(await timelock.queuedTransactions(txHash1), true);

    await timelock.queueTransaction(target, value, signature, data2, eta);
    const txQueues2 = await timelock.txQueues(1);
    const txHash2 = txQueues2.txHash;
    assertEqual(await timelock.queuedTransactions(txHash2), true);

    await timelock.queueTransaction(target, value, signature, data3, eta);
    const txQueues3 = await timelock.txQueues(2);
    const txHash3 = txQueues3.txHash;
    assertEqual(await timelock.queuedTransactions(txHash3), true);

    await expectThrow(timelock.executeTransactionWithID(0, {from: a1}), "Timelock::executeTransaction: Call must come from admin.");
    await expectThrow(timelock.executeTransactionWithID(0), "Timelock::executeTransaction: Transaction hasn't surpassed time lock.");

    await timelock.cancelTransactionWithID(0);
    await expectThrow(timelock.executeTransactionWithID(0), "Timelock::executeTransaction: Transaction hasn't been queued.");

    increaseTime(deplayPeriod.plus(100).toNumber());
    await timelock.executeTransactionWithID(1);
    assertEqual(await timelock.delay(), deplayPeriod.times(2));

    increaseTime(deplayPeriod.plus(1000000000000000).toNumber());
    await expectThrow(timelock.executeTransactionWithID(2), "Timelock::executeTransaction: Transaction is stale.");

  });

  it('set new admin', async () => {
    await expectThrow(timelock.setPendingAdmin(newAdmin, {from: a1}), "Timelock::setPendingAdmin: Call must come from Timelock.");
    const blockTime = await timelock.getBlockTimestamp();
    assertEqual(await timelock.delay(), deplayPeriod);
    const [target, value, signature, data, eta] = [
      timelock.address,
      zero,
      "setPendingAdmin(address)",
      encodeParameters(['address'], ["0x31ea5C0f6E2263dE6d39bCa11A0c8D23ec9E3780"]),
      deplayPeriod.plus(blockTime).plus(2)
    ];

    console.log("dataaaaaaa", data);
    await timelock.queueTransaction(target, value, signature, data, eta);
    const txQueues = await timelock.txQueues(0);
    const txHash = txQueues.txHash;
    assertEqual(await timelock.queuedTransactions(txHash), true);
    increaseTime(deplayPeriod.plus(100).toNumber());
    await timelock.executeTransactionWithID(0);
    assertEqual(await timelock.pendingAdmin(), newAdmin);

    await expectThrow(timelock.acceptAdmin({from: a1}), "Timelock::acceptAdmin: Call must come from pendingAdmin.");
    await timelock.acceptAdmin({from: newAdmin});
    assertEqual(await timelock.admin(), newAdmin);
  });
});


function assertEqual (val1, val2, errorStr) {
  val2 = val2.toString();
  val1 = val1.toString()
  assert(new BN(val1).should.be.a.bignumber.that.equals(new BN(val2)), errorStr);
}

function expectError(message, messageCompare) {
  messageCompare = "Error: VM Exception while processing transaction: reverted with reason string '" + messageCompare + "'";
  assert(message == messageCompare, 'Not valid message');
}

async function expectThrow(f1, messageCompare) {
  let check = false;
  try {
    await f1;
  } catch (e) {
    check = true;
    expectError(e.toString(), messageCompare)
  };

  if (!check) {
    assert(1 == 0, 'Not throw message');
  }
}

async function increaseTime(second) {
  await ethers.provider.send('evm_increaseTime', [second]); 
  await ethers.provider.send('evm_mine');
}
