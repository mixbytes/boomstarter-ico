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

To deploy on a testnet set `testnet` flag in all migrations to `true`

```javascript
var testnet = true;
```

Also, set appropriate addresses in the code defining addresses for testnet
```javascript
} else if (testnet) {
  _owners = [
...
```

## Production

Note, that stages already deployed to productoin go under `if (!producton)` condition. So full migration cycle runs only in testnet or ganache mode.

Before running deploy please make sure the following values are correct:

* in "migrations/" in all files starting from 2_: `production` should be `true`
* in "migrations/" in all files starting from 2_: `_owners` and `beneficiary` under `if (production)` condition should be replaced with appropriate values
* if you're going to use infura, then in "infura_conf.js", there should be appropriate `mnemonic` and `token`
* in "truffle.js" in the network you are going to use, check that `gasPrice` equals to the current safe value [from here](https://ethgasstation.info/)
* if you're going to use a local node, make sure it's syncronized, main account is unlocked (`--unlock <address>` in geth) and rpc mode is enabled (`--rpc` flag in geth)
* check production<...> addresses (such as `productionTokenAddress`) in all migration files: they are the ones that are already deployed and should be used instead of relying on `.deployed()` artifacts

To deploy (as an example to infura ropsten) run:

    $ truffle migrate --network infura_ropsten

Look into "truffle.js" for different networks

## Usage
### Presale Summary

1. During deploy, BoomstarterPresale automatically launches **updateEthPriceInCents()** and the first one is free. But keep in mind that first, the update will be completed after 12 hours, and second, when it's completed it's going to call delayed update once more. For this call to succeed you need to have your contract to have some ether for oraclize transactions. You can add ether by calling **topUp()** and specifying the amount of ether to send.
2. If you provide ether before the first update, the update process will continue without any additional input from your part. If you don't - then update is most likely stopped: not enough ether to pay for an oraclize transaction. To start update again run **updateEthPriceInCents()**, it's payable, so you can provide some oraclize ether without calling **topUp()**. If the price is within the bounds, it is updated once contract gets reply from oraclize. If not - price is not updated, but another update request is still called. To change price bounds let owners call **setETHPriceUpperBound(uint _price)** / **setETHPriceLowerBound(uint _price)**. If you don't want or cannot start oraclize update, you can let owners call 
**setETHPriceManually(uint _price)** to set price to any value (it's a backup option and not recommended + can only be called if price is expired or the update is not running)
3. To check the price update status call either **priceExpired()** to check if the price was updated more than two update intervals ago, or **updateRequestExpired()**, which means update can be called once more. Note that **updateRequestExpired()** returning true doesn't mean, that the update stopped. The callback from oraclize might still come through and call update automatically, so it's adviced to rerun it taking into consideration oraclize lag.
4. When price is ready, investors can call **buy()**, tokens will be assigned to the buyer, ether will be transferred to the account specified as `beneficiary` during deploy. The amount of tokens will be calculated from the token price depending on phase and ether price, retrieved from oraclize or set by owners. NOTE: **buy()** cannot be called if **priceExpired()** returns `true`.
5. If, at the time of investing, amount of tokens sold turns out more than the amount at which the price should increase (from $0.3 to $0.4 for a token), then the investor will receive only the part of tokens bought at the lower price, remaining ether will be refunded. All following calls to **buy()** will be using the higher price (as all lower-price tokens are sold now)
6. Same goes if amount of tokens sold is more than the amount provided for presale: remaining ether will be refunded to the investor.
7. When the sale is finished owners should call **finishSale()** to transfer all remaining tokens and ether to the new sale contract. Note that the new sale contract should be set before calling finish. Do that with **setNextSale(address _sale)** function (multisig required).


### PreICO Summary

PreICO is the same as Presale (see **Presale Summary**) except for the following differences:
1. Update repeats every 1 hour instead of every 12 hours
2. Price of tokens is constant and is equal to $0.6
4. Big investors (investing equal or more than $30k) receive a bonus of +20% tokens from the amount bought. Note, that the amount of an investment is calculated taking into account the sale cap (which is 5 million tokens) and not just the amount of ether sent during investment transaction. If the resulting number of tokens bought (without bonus) exceeds the sale cap, maximum available amount is used instead, and the investor receives the ether remainder. The actual ether amount left is used to calculate if the investor should receive the bonus or not (bonus is not affected by the sale cap, but for obvious reasons it can only happen once for the last investor buying all remaining in that sale tokens)

Full summary for convenience (modified Presale Summary):
1. During deploy, BoomstarterPreICO automatically launches **updateEthPriceInCents()** and the first one is free. But keep in mind that first, the update will be completed after 1 hours, and second, when it's completed it's going to call delayed update once more. For this call to succeed you need to have your contract to have some ether for oraclize transactions. You can add ether by calling **topUp()** and specifying the amount of ether to send.
2. If you provide ether before the first update, the update process will continue without any additional input from your part. If you don't - then update is most likely stopped: not enough ether to pay for an oraclize transaction. To start update again run **updateEthPriceInCents()**, it's payable, so you can provide some oraclize ether without calling **topUp()**. If the price is within the bounds, it is updated once contract gets reply from oraclize. If not - price is not updated, but another update request is still called. To change price bounds let owners call **setETHPriceUpperBound(uint _price)** / **setETHPriceLowerBound(uint _price)**. If you don't want or cannot start oraclize update, you can let owners call 
**setETHPriceManually(uint _price)** to set price to any value (it's a backup option and not recommended + can only be called if price is expired or the update is not running)
3. To check the price update status call either **priceExpired()** to check if the price was updated more than two update intervals ago, or **updateRequestExpired()**, which means update can be called once more. Note that **updateRequestExpired()** returning true doesn't mean, that the update stopped. The callback from oraclize might still come through and call update automatically, so it's adviced to rerun it taking into consideration oraclize lag.
4. When price is ready, investors can call **buy()**, tokens will be assigned to the buyer, ether will be transferred to the account specified as `beneficiary` during deploy. The amount of tokens will be calculated from the constant token price of $0.6 and the ether price, retrieved from oraclize or set by owners. NOTE: **buy()** cannot be called if **priceExpired()** returns `true`.
5. Big investors (investing equal or more than $30k) receive a bonus of +20% tokens from the amount bought. Note, that the amount of an investment is calculated taking into account the sale cap (which is 5 million tokens) and not just the amount of ether sent during investment transaction. If the resulting number of tokens bought (without bonus) exceeds the sale cap, maximum available amount is used instead, and the investor receives the ether remainder. The actual ether amount left is used to calculate if the investor should receive the bonus or not (bonus is not affected by the sale cap, but for obvious reasons it can only happen once for the last investor buying all remaining in that sale tokens)
6. When the sale is finished owners should call **finishSale()** to transfer all remaining tokens and ether to the new sale contract. Note that the new sale contract should be set before calling finish. Do that with **setNextSale(address _sale)** function (multisig required).

### BoomstarterToken Summary

1. Initially all tokens are issued to the deployer. In the deploy script the deployer immediately sends all of them to Presale contract, changes its role to 'sale' and revokes their own 'sale' role. This is required because of the following logic with tokens: everything is frozen initially and the _transfer_ functions family (as well as _burn_) can only be called from trusted contracts (the ones having 'sale' role).
2. It shouldn't be required to set 'sale' manually as **finishSale()** in Presale takes care of it. However as a backup you can let owners call **setSale(address, bool)** to grant anyone 'sale' role.
3. When all the sales are finished and you wish to unfreeze all tokens - let owners call **thaw()** and from now on the token will be behaving as a regular ERC20 one.
4. The last thing that should be called by owners is **disablePrivileged()**. After that owners will have no control over the token.


## Functions Reference
### BoomstarterPresale contract _and_ BoomstarterPreICO contract

**buy()** / **fallback function**

Main function for investors, is payable, ether sent will be further transferred to the beneficiary account, appropriate amount of tokens will be assigned to the caller account.

Requirements:
* presale shouldn't be over, which happens either if the time deadline has passed, or `finishSale` was called by the owners
* ether price should be non-zero. It's zero by default and updated by oraclize call after an hour-long delay
* ether price shouldn't be expired, see **priceExpired()**

**updateETHPriceInCents()**

Function to run price update process in case it's not running yet. Is payable, put some ether for oraclize queries to use. Update continues indefinitely with the interval of 12 hours (Presale) or 1 hour (PreICO). Process stops if all ether is depleted.

Requirements:
* update process shouldn't be already active, see **updateRequestExpired()**
* BoomstarterPresale contract should have enough ether to pay for oraclize queries

**setETHPriceUpperBound(uint _price)** / **setETHPriceLowerBound(uint _price)**

Functions to set valid boundaries of the price retrieved by oraclize.

Requires 2 owners' multisignature

Input: _price - price value in US cents

**setETHPriceManually(uint _price)**

In case oraclize didn't update the price for some reason, call this to set any price manually.

Requirements:
* 2 owners' multisignature
* current price is expired - more than double the update interval passed since last price update, OR last update request is expired

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

**priceExpired()**

Check if the price was last retrieved or set more than double the update interval ago

Output: true if expired

**updateRequestExpired()**

Check if the last update request was sent more than 1 update interval ago. If `true` update can be called manually

Output: true if expired

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
