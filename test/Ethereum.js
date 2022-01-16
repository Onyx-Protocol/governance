"use strict";

const BigNum = require('bignumber.js');
const ethers = require('ethers');

function etherUnsigned(num) {
  return new BigNum(num).toFixed();
}

async function increaseTime(seconds) {
  await rpc({ method: 'evm_increaseTime', params: [seconds] });
  return rpc({ method: 'evm_mine' });
}

async function setTime(seconds) {
  await rpc({ method: 'evm_setTime', params: [new Date(seconds * 1000)] });
}

async function freezeTime(seconds) {
  await rpc({ method: 'evm_freezeTime', params: [seconds] });
  return rpc({ method: 'evm_mine' });
}


function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

async function mineBlockNumber(blockNumber) {
  return rpc({method: 'evm_mineBlockNumber', params: [blockNumber]});
}


module.exports = {
  mineBlockNumber,
  etherUnsigned,
  freezeTime,
  increaseTime,
  setTime,
  encodeParameters
};
