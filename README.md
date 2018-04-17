# Boomstarter ICO

Boomstarter token and sale contracts

## Installation

This is a truffle project. Make sure you have all the required modules installed by running:

    $ npm install
  
## Testing

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

* in "migrations/" in all files starting from 2_: `production` should be `true`
* in "migrations/" in all files starting from 2_: `_owners` and `beneficiary` should be replaced with appropriate values
* if you're going to use infura, then in "infura_conf.js", there should be appropriate `mnemonic` and `token`
* in "truffle.js" in the network you are going to use, check that `gasPrice` equals to the current safe value [from here](https://ethgasstation.info/)
* if you're going to use a local node, make sure it's syncronized, main account is unlocked (`--unlock <address>` in geth) and rpc mode is enabled (`--rpc` flag in geth)

To deploy (as example to infura ropsten) run:

    $ truffle migrate --network infura_ropsten

Look into "truffle.js" for different networks

## Usage

### BoomstarterPresale contract

**buy()** / **fallback function**

Main function for investors, is payable, ether sent will be further transferred to the beneficiary account, appropriate amount of tokens will be assigned to the caller account.

Requirements:
* presale shouldn't be over, which happens either if the time deadline has passed, or `finishSale` was called by the owners
* ether price should be non-zero. It's zero by default and updated by oraclize call after an hour-long delay

**updateETHPriceInCents()**

Function to run price update process in case it's not running yet. Is payable, put some ether for oraclize queries to use. Update continues indefinitely with the interval of 1 hour. Process stops if all ether is depleted or retrieved price is out of bounds.

Requirements:
* update process shouldn't be already active, except for the case when price is expired (more than double the update interval passed without price being updated)
* BoomstarterPresale contract should have enough ether to pay for oraclize queries

**setETHPriceUpperBound(uint _price)** / **setETHPriceLowerBound(uint _price)**

Functions to set valid boundaries of the price retrieved by oraclize.

Requires 2 owners' multisignature

Input: _price - price value in US cents

**setETHPriceManually(uint _price)**

In case oraclize didn't update the price for some reason, call this to set any price manually.

Requirements:
* 2 owners' multisignature
* current price is expired - more than double the update interval passed since last price update

Input: _price - price value in US cents

**topUp()**

Payable function to send some ether to the contract for oraclize to use. Required because the fallback function sees incoming ether as investments. All unspent ether will be transferred to the next sale once this one is finished

**finishSale()**

Function to mark presale as over and transfer all remaining ether and tokens to the next sale.

Requirements:
* 2 owners' multisignature
* next sale address should be set using `setNextSale`

**setNextSale(address _sale)**

Set address that will handle next presale. Everything will be transferred once finishSale is called

Requires 2 owners' multisignature

Input: _sale - address of the next sale

### BoomstarterToken

Contract is compliant with ERC20 and mixbytes/multiowned interfaces. Non-standard functions:

**setSale(address account, bool isSale)**

Give (or revoke) 'sale' role from an account. The role is required for sale contracts and allows for frozen token transferring and making switch to the next sale contract.

Requires 2 owners' multisignature

Input:
* account - address to set role to
* isSale - true to grant, false to revoke

**disablePrivileged()**

Prohibit all further administrative actions comming from owners.

Requirements:
* 2 owner's multisignature
* token should be already unfrozen using `thaw`

**thaw()**

Unfreeze token - make it available for everyone to use as a regular ERC20 token. While the token is frozen, the only accounts able to transfer it are accounts with 'sale' role

Requires 2 owners' multisignature

**burn(uint256 _amount)**

Let the caller burn a certain number of tokens from their balance.

Requires token to be unfrozen

Input: _amount - number of tokens to burn
