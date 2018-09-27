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

console.log("\x1b[35mDeploy sale minter\x1b[0m\n")

const BoomstarterSale = artifacts.require('BoomstarterSale.sol');
const ReenterableMinter = artifacts.require('ReenterableMinter.sol');

module.exports = function(deployer, network) {
  deployer.then(function() {
    return BoomstarterSale.deployed();
  }).then( function(sale) {
    // 4
    return deployer.deploy(ReenterableMinter, sale.address);
  }).then( function(minter) {
    // 5
    return minter.transferOwnership('0x670fe59447e6e61b8f245901095ba4b19ac9bff5');
  })
};
