const FakeToken = artifacts.require('FakeToken');
const CHNGovernance = artifacts.require('CHNGovernance');
const CHNTimelock = artifacts.require('CHNTimelock');
const TimelockHarness = artifacts.require('TimelockHarness');
const { default: BigNumber } = require('bignumber.js');
const { assert } = require('chai');
const { ethers, waffle } = require('hardhat');

const BN = web3.utils.BN;
const {
  etherUnsigned,
  freezeTime,
  encodeParameters,
  mineBlockNumber
} = require('./Ethereum');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bn')(BN))
  .should();

contract('CHNGovernance Contract', function (accounts) {
  let root = accounts[0];
  let a1 = accounts[1];
  let a2 = accounts[2];
  let newAdmin = accounts[3];
  let token;
  let timelock;
  let governance;

  const deplayPeriod = new BigNumber(3).times(24).times(60).times(60);
  const zero = new BigNumber(0);
  const gracePeriod = deplayPeriod.times(2);
  const proposalThreshHold = new BigNumber('100000000000000000000');
  const notValidThreshHold = proposalThreshHold.minus(1);

  beforeEach(async () => {
    timelock = await TimelockHarness.new(root, deplayPeriod);
    token = await FakeToken.new("10000000000000000000000000");
    let configs = [proposalThreshHold, proposalThreshHold, 5, 1, 17280];
    governance = await CHNGovernance.new(timelock.address, token.address, root, configs);
  });

  it('create proposal: check vote', async () => {
    targets = [governance.address, governance.address];
    values = ["0", "0"];
    signatures = ["changeQuorumVotes(uint256)", "changeProposalThreshold(uint256)"];
    callDatas = [encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()]), encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()])];

    await expectThrow(governance.propose(targets, values, signatures, callDatas, "This is test", {from: a1}), "GovernorAlpha::propose: proposer votes below proposal threshold");
    token.mintForUser(notValidThreshHold, {from: a1});
    await expectThrow(governance.propose(targets, values, signatures, callDatas, "This is test", {from: a1}), "GovernorAlpha::propose: proposer votes below proposal threshold");
    token.mintForUser(3, {from: a1});
    await governance.propose(targets, values, signatures, callDatas, "This is test", {from: a1});
    await expectThrow(governance.propose(targets, values, signatures, callDatas, "This is test", {from: a1}), "GovernorAlpha::propose: found an already pending proposal");
    assertEqual(await governance.proposalCount(), '1');
  });

  it('create proposal: check max action', async () => {
    let newConfig = [proposalThreshHold, proposalThreshHold, 1, 1, 17280];
    const newGov = await CHNGovernance.new(timelock.address, token.address, root, newConfig);

    targets = [governance.address, governance.address];
    values = ["0", "0"];
    signatures = ["changeQuorumVotes(uint256)", "changeProposalThreshold(uint256)"];
    callDatas = [encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()]), encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()])];
    await expectThrow(newGov.propose(targets, values, signatures, callDatas, "This is test", {from: root}), "GovernorAlpha::propose: too many actions");
  });

  it('cast proposal', async () => {
    let newConfig = [proposalThreshHold, proposalThreshHold, 2, 0, 100];
    const newGov = await CHNGovernance.new(timelock.address, token.address, root, newConfig);
    targets = [governance.address, governance.address];
    values = ["0", "0"];
    signatures = ["changeQuorumVotes(uint256)", "changeProposalThreshold(uint256)"];
    callDatas = [encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()]), encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()])];

    await newGov.propose(targets, values, signatures, callDatas, "This is test", {from: root});
    const beforeVote = await newGov.proposals(1);

    await newGov.castVote(1, true);
    const afterVote1 = await newGov.proposals(1);

    token.mintForUser(3, {from: a1});
    await newGov.castVote(1, false, {from: a1});
    const afterVote2 = await newGov.proposals(1);
    await expectThrow(newGov.castVote(1, {from: a1}), "GovernorAlpha::_castVote: voter already voted");

  });

  it('queue proposal', async () => {
    let newConfig = [proposalThreshHold, proposalThreshHold, 2, 0, 2];
    const newGov = await CHNGovernance.new(timelock.address, token.address, root, newConfig);
    targets = [governance.address, governance.address];
    values = ["0", "0"];
    signatures = ["changeQuorumVotes(uint256)", "changeProposalThreshold(uint256)"];
    callDatas = [encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()]), encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()])];

    await newGov.propose(targets, values, signatures, callDatas, "This is test", {from: root});
    await newGov.castVote(1, true);
    await expectThrow(newGov.queue(1), "GovernorAlpha::queue: proposal can only be queued if it is succeeded");
    await timelock.harnessSetAdmin(newGov.address);
    await newGov.queue(1);
  });

  it('cancel proposal', async () => {
    let newConfig = [proposalThreshHold, proposalThreshHold, 2, 0, 200];
    const newGov = await CHNGovernance.new(timelock.address, token.address, root, newConfig);
    await timelock.harnessSetAdmin(newGov.address);
    targets = [governance.address, governance.address];
    values = ["0", "0"];
    signatures = ["changeQuorumVotes(uint256)", "changeProposalThreshold(uint256)"];
    callDatas = [encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()]), encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()])];
    token.mintForUser(proposalThreshHold, {from: a1});
    await newGov.propose(targets, values, signatures, callDatas, "This is test", {from: a1});
    await expectThrow(newGov.cancel(1, {from: a1}), "GovernorAlpha::cancel: proposer above threshold");
    await token.transfer(a2, 10000, {from: a1});
    await newGov.cancel(1, {from: a1});

  });

  it('cancel proposal', async () => {
    let newConfig = [proposalThreshHold, proposalThreshHold, 2, 0, 2];
    const newGov = await CHNGovernance.new(timelock.address, token.address, root, newConfig);
    targets = [newGov.address, newGov.address];
    values = ["0", "0"];
    signatures = ["changeQuorumVotes(uint256)", "changeProposalThreshold(uint256)"];
    callDatas = [encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()]), encodeParameters(['uint256'], [proposalThreshHold.plus(1).toString()])];

    await newGov.propose(targets, values, signatures, callDatas, "This is test", {from: root});
    await newGov.castVote(1, true);
    await expectThrow(newGov.queue(1), "GovernorAlpha::queue: proposal can only be queued if it is succeeded");
    await timelock.harnessSetAdmin(newGov.address);
    await newGov.queue(1);

    await timelock.harnessExecuteTransactionWithID(0);
    assertEqual(await newGov.quorumVotes(), proposalThreshHold.plus(1).toString());
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
