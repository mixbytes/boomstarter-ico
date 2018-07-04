'use strict';

const production = process.env.PRODUCTION != null ;
const testnet = process.env.TESTNET != null;
const testnet_rinkeby = process.env.TESTNET_RINKEBY != null;

console.log(
"\n\n\n\x1b[32m####################\n" +
"Migration environment\n" +
"production: " + (production) + "\n" +
"testnet: " + (testnet) + "\n" +
"testnet_rinkeby: " + (testnet_rinkeby) + "\n" +
"####################\x1b[0m\n"
)
console.log("\x1b[35mDeploy minter\x1b[0m\n")

var _owners;
var _previousSales = [];
var beneficiary;
var minter_owner;
if (production) {
  _owners = [
      '0x7BFE571D5A5Ae244B5212f69952f3B19FF1B7e54',
      '0x386f2BD2808E96c8A23f698765dCdbe10D08F201',
      '0xB22D86AAC527A68327ECC99667e98429C2d4E2eb',
  ];
  _previousSales = [
      '0x0C64f31DE90463f947F78a623E75414D0c4aC3f1',
      '0xF6200480118179e3CCEDeF75738be7C62B356B6A'
  ];
  minter_owner = _owners[0];

} else if (testnet) {
  _owners = [
      '0x7bd62eb4c43688314a851616f1dea4b29bc4eaa6',
      '0x903030995e1cfd4e2f7a5399ed5d101c59b6a6e9',
      '0x3c832c4cb16ffee070334ed59e30e8d149556ef4',
  ];
  minter_owner = _owners[0];

} else if (testnet_rinkeby) {
  _owners = [
      '0xe4bebb493e6c7663e1f3c6b463c7b573bd051ccf',
      '0x1462d1bbf707128437a17310fd784c24a1dda846',
      '0x3bb48c702a5b67b58d93efa5043f186fe375fdb0'
  ];
  minter_owner = _owners[0];

} else {
  _owners = [
      web3.eth.accounts[0],
      web3.eth.accounts[1],
      web3.eth.accounts[2]
  ];
  beneficiary = web3.eth.accounts[3];
  minter_owner = web3.eth.accounts[4];
}

const BoomstarterICO = artifacts.require('BoomstarterICO.sol');
const ReenterableMinter = artifacts.require('ReenterableMinter.sol');

var boomstarterIco;
var boomstarterMinter;

module.exports = function(deployer, network) {
  deployer.then(function() {
    return BoomstarterICO.deployed();
  }).then( function(ico) {
    boomstarterIco = ico
    var ico_address = ico.address;
    return deployer.deploy(ReenterableMinter, ico_address);
  }).then( function(minter) {
    boomstarterMinter = minter
    return boomstarterIco.setNonEtherController(boomstarterMinter.address, {from: _owners[0]})

  }).then( function(funds) {
    return boomstarterIco.setNonEtherController(boomstarterMinter.address, {from: _owners[1]})
  }).then( function(funds) {
    return boomstarterMinter.transferOwnership(minter_owner)
  })
};
