require('babel-register');
require('babel-polyfill');

var HDWalletProvider = require("truffle-hdwallet-provider");
const infura = require('./infura_conf');
var mnemonic = infura.mnemonic;
var token = infura.token;

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 4700000
    },

    ropsten: {  // locally-run testnet
      host: "localhost",
      port: 8545,
      network_id: 3,
      gasPrice: 23000000000,
      gas: 4700000
    },

    infura_ropsten: { // infura testnet
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/" + token)
      },
      network_id: 3,
      gasPrice: 23000000000,
      gas: 4700000
    },

    mainnet: { // locally-run mainnet
      host: "localhost",
      port: 8549,
      network_id: 1,
      gasPrice: 1 * 1e9
    },

    infura_mainnet: { // infura mainnet
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://mainnet.infura.io/" + token)
      },
      network_id: 1,
      gasPrice: 1 * 1e9,
      gas: 7000000
    }
  },

  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
