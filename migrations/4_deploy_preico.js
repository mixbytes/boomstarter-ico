'use strict';

const production = false;
const testnet = false;

const updateInterval = 60*60; // 1 hour
const productionTokenAddress = "0x2Acb0BB95063756d66f67D0c9624b12CAc529fB3";

var _owners;
var beneficiary;
if (production) {
  _owners = [
      '0x7BFE571D5A5Ae244B5212f69952f3B19FF1B7e54',
      '0x386f2BD2808E96c8A23f698765dCdbe10D08F201',
      '0xB22D86AAC527A68327ECC99667e98429C2d4E2eb',
  ];
  beneficiary = '0x821F35b8AC42eaB05d4870E104c84c983B1B84f4';
} else if (testnet) {
  _owners = [
      '0x7bd62eb4c43688314a851616f1dea4b29bc4eaa6',
      '0x903030995e1cfd4e2f7a5399ed5d101c59b6a6e9',
      '0x3c832c4cb16ffee070334ed59e30e8d149556ef4',
  ];
  beneficiary = '0x47900c119370cc3ad78cbda6f39a0abc75e39ae1';
} else {
  _owners = [
      web3.eth.accounts[0],
      web3.eth.accounts[1],
      web3.eth.accounts[2]
  ];
  beneficiary = web3.eth.accounts[3];
}

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');
const BoomstarterPreICO = artifacts.require('BoomstarterPreICO.sol');

var boomstarterToken;

module.exports = function(deployer, network) {
  deployer.then( function() {
    if (production) {
      return BoomstarterToken.at(productionTokenAddress);
    } else {
      return BoomstarterToken.deployed();
    }
  }).then( function(token){
    boomstarterToken = token;
    return deployer.deploy(BoomstarterPreICO, _owners, token.address,
                           beneficiary, updateInterval, production || testnet);
  })
  // Do manually:
  // presale.setNextSale( preICO.address ) multisig
  // presale.finishSale() multisig
};
