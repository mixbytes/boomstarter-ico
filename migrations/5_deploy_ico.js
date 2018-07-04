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

console.log("\x1b[34mDeploy ico\x1b[0m\n")


var _owners;
var _previousSales = [];
var beneficiary;
var previousFunds = 100;

if (production) {
  _owners = [
      '0x7BFE571D5A5Ae244B5212f69952f3B19FF1B7e54',
      '0x386f2BD2808E96c8A23f698765dCdbe10D08F201',
      '0xB22D86AAC527A68327ECC99667e98429C2d4E2eb',
  ];
} else if (testnet) {
  _owners = [
      '0x7bd62eb4c43688314a851616f1dea4b29bc4eaa6',
      '0x903030995e1cfd4e2f7a5399ed5d101c59b6a6e9',
      '0x3c832c4cb16ffee070334ed59e30e8d149556ef4',
  ];
} else if (testnet_rinkeby) {
  _owners = [
      '0xe4bebb493e6c7663e1f3c6b463c7b573bd051ccf',
      '0x1462d1bbf707128437a17310fd784c24a1dda846',
      '0x3bb48c702a5b67b58d93efa5043f186fe375fdb0'
  ];
} else {
  _owners = [
      web3.eth.accounts[0],
      web3.eth.accounts[1],
      web3.eth.accounts[2]
  ];
  beneficiary = web3.eth.accounts[3];
}

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');
const BoomstarterICO = artifacts.require('BoomstarterICO.sol');
const FundsRegistry = artifacts.require('FundsRegistry.sol');

var boomstarterToken;
var fundRegistry;
var boomstarterIco;

module.exports = function(deployer, network) {
  deployer.then( function() {
    return BoomstarterToken.deployed();
  }).then( function(token) {
    boomstarterToken = token;
    return deployer.deploy(BoomstarterICO, _owners, boomstarterToken.address, production || testnet || testnet_rinkeby);
  }).then( function(ico) {
    boomstarterIco = ico;
    return deployer.deploy(FundsRegistry, _owners, 2, ico.address, boomstarterToken.address);
  })
  // Do manually:
  // preIco.setNextSale( ico.address ) multisig
  // preIco.finishSale() multisig
  // Then
  // boomstarterIco.init(fundsRegistry.address, beneficiary, previousFunds) multisig
  // token.setSale(fundsRegistry.address, true) multisig
};
