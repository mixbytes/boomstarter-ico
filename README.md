# Boomstarter ICO

Boomstarter token and sale contracts

## Installation

This is a truffle project. Make sure you have all the required modules installed by running:

    $ npm install
  
## Testing

Check that `bridge` is set to `true` in "contracts/EthPriceDependent.sol" constructor:

```c
bool bridge = true;
```
Check that `production` is set to `false` in all migrations files starting from 2_:

```javascript
var production = false;
```

Make sure ganache is running with enough accounts:

    $ ganache-cli -a 8

In order to run tests through ganache you need to have [ethereum-bridge](https://github.com/oraclize/ethereum-bridge). 
Run it in active mode with the following command (from the ethereum-bridge dir):

    $ node bridge --dev

Wait for the bridge to deploy its contracts, then finally run the tests:

    $ truffle test

## Production

Before running deploy please make sure the following values are correct:

* in "contracts/EthPriceDependent.sol" in the constructor: `bridge` should be `false`
* in "migrations/" in all files starting from 2_: `production` should be `true`
* in "migrations/" in all files starting from 2_: `_owners` and `beneficiary` should be replaced with appropriate values
* if you're going to use infura, then in "infura_conf.js", there should be appropriate `mnemonic` and `token`
* in "truffle.js" in the network you are going to use, check that `gasPrice` equals to the current safe value [from here](https://ethgasstation.info/)
* if you're going to use a local node, make sure it's syncronized, main account is unlocked (`--unlock <address>` in geth) and rpc mode is enabled (`--rpc` flag in geth)

To deploy (as example to infura ropsten) run:

    $ truffle migrate --network infura_ropsten

Look into "truffle.js" for different networks

## Usage

TODO


