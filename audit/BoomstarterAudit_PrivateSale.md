# Boomstarter ICO Audit: *Private Sale Phase*

May, 2018

Authored by [Basil Gorin](https://www.linkedin.com/in/gorin/), reviewed and contributed by [Vladimir Ovcharov](https://www.linkedin.com/in/vladimirovcharov/)

# Introduction

[Boomstarter](https://boomstarter.ru/) requested a smart contracts audit to be performed 
 for their Private Sale Boomstarter ICO campaign. 
 These are an ERC20 token and crowdsale smart contracts built on top of internal and external libraries.

The contracts are hosted at: https://github.com/mixbytes/boomstarter-ico

An audit is performed in the fork: https://github.com/vgorin/boomstarter-ico

## Scope of the Audit:
1. Smart contracts  
   ```
   contracts/
      test_helpers/
         BoomstarterPresaleTestHelper.sol
         BoomstarterTokenTestHelper.sol
         TestApprovalRecipient.sol
      token/
         BurnableToken.sol
         TokenWithApproveAndCallMethod.sol
      BoomstarterPresale.sol
      BoomstarterToken.sol
      EthPriceDependent.sol
      IBoomstarterToken.sol
      Migrations.sol
   ```
2. Deployment scripts
   ```
   migrations/
      1_initial_migration.js
      2_deploy_token.js
      3_deploy_presale.js
   ```

## Out of Scope:
1. Oraclize integration
   ```
   oraclize/
      usingOraclize.sol
   ```
2. External dependencies
   ```
   zeppelin-solidity/
      contracts/
         token/
            BasicToken.sol
            StandardToken.sol
         ReentrancyGuard.sol
         SafeMath.sol
   mixbytes-solidity/
      contracts/
         security/
            ArgumentsChecker.sol
         ownership/
            multiowned.sol
   ```
3. Tests
   ```
   test/
      *
   ```

The final git commit hash evaluated is ```7491b44c4eb2b6787c283efc082cdc306ba2d893```. 
 Herein and throughout the document is referenced as the *latest* commit.

This document also highlights issues found in previous versions of the project 
 (hashes ```85b20f627a47c30a44858036e70dec1bdbbfd53c``` and ```3c7a5caac709a6239ed25fe66524d06873410348```) 
 but fixed in latest commit as a result of this audit.

# Disclaimer

The audit makes no statements or warranties about utility of the code, safety of the code, 
 suitability of the business model, regulatory regime for the business model, 
 or any other statements about fitness of the contracts to purpose, or their bug-free status. 
 The audit documentation is for discussion purposes only.

# Abstract

The smart contract source code provided allows for a fixed supply token emission of thirty six million (36 000 000)
 "BoomstarterCoin" (BC) tokens and further sale of these tokens in several phases.

The token designed to be frozen (non-transferable) during the sale period. It unfreezes and becomes transferable
 after this period in an irreversible way.

The presale is designed to allow token price updates in response to market ETH price changes.

Overall the codebase is of reasonably high quality -- it is clean, well documented, follows the majority 
 of [coding conventions](https://solidity.readthedocs.io/en/latest/style-guide.html) for writing solidity code.

We did not identify any critical vulnerabilities in the source code.

# Basic Overview and Nice Features

During the sale period the token and private sale smart contracts are controlled by three owners, 
 defined in deployment scripts, in a MultiSig manner, provided by 
 [multiowned](https://github.com/mixbytes/solidity/blob/master/contracts/ownership/multiowned.sol) library 
 by [MixBytes LLC](https://mixbytes.io/). The token itself is initially non-transferable.

The owners are:
* [```0x7BFE571D5A5Ae244B5212f69952f3B19FF1B7e54```](https://etherscan.io/address/0x7BFE571D5A5Ae244B5212f69952f3B19FF1B7e54)
* [```0x386f2BD2808E96c8A23f698765dCdbe10D08F201```](https://etherscan.io/address/0x386f2BD2808E96c8A23f698765dCdbe10D08F201)
* [```0xB22D86AAC527A68327ECC99667e98429C2d4E2eb```](https://etherscan.io/address/0xB22D86AAC527A68327ECC99667e98429C2d4E2eb)

The quorum is two votes out of three.

After all the sale phases are finished the token may be released by the owners to become fully feature reached 
 [ERC20](https://en.wikipedia.org/wiki/ERC20) token without any limitations on transferring and trading.

The beneficiary of the private sale is defined in deployment scripts, this is a MultiSig address 
 [```0x821F35b8AC42eaB05d4870E104c84c983B1B84f4```](https://etherscan.io/address/0x821F35b8AC42eaB05d4870E104c84c983B1B84f4)

There is a nice automatic feature of the private sale smart contract, which updates token price every 
 12 hours using the CoinMarketCap data, as provided by their API 
 [https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=USD]()

The price update is performed through [Oraclize](https://www.oraclize.it/) API.

The repository contains deployment scripts and Truffle unit tests, made in a clean and good manner.


# Critical Vulnerabilities

There are no critical issues in the smart contracts and deployment scripts audited found.


# Medium Vulnerabilities

## Vulnerability in ETH Price Update

Under certain conditions ```updateETHPriceInCents()``` in ```EthPriceDependent.sol``` allows running multiple instances 
 at a time and may be used by an attacker to exhaust the smart contract balance reserved for Oraclize queries and break 
 the designed ETH rate update routine with Oraclize.

### The Issue Reproduced

The issue was successfully reproduced in rinkeby test network.

Presale at address [0x90c7300e067e16f9f0369bfc97451d40e61bb7ac](https://rinkeby.etherscan.io/address/0x90c7300e067e16f9f0369bfc97451d40e61bb7ac) 
 is expected to update ETH price once per hour, however update queries happen more frequent than one per hour.


### The Issue Explained

Consider the following code in EthPriceDependent.sol, responsible for ETH rate update workflow with Oraclize:

```
/// @notice Send oraclize query.
/// if price is received successfully - update scheduled automatically,
/// if at any point the contract runs out of ether - updating stops and further
/// updating will require running this function again.
/// if price is out of bounds - updating stops
function updateETHPriceInCents() public payable {
    // prohibit running multiple instances of update
    require((m_ETHPriceUpdateRunning == false) || (priceExpired()));
    if (oraclize_getPrice("URL") > this.balance) {
        NewOraclizeQuery("Oraclize request fail. Not enough ether");
    } else {
        oraclize_query(
            m_ETHPriceUpdateInterval,
            "URL",
            "json(https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=USD).0.price_usd"
        );
        m_ETHPriceUpdateRunning = true;
        NewOraclizeQuery("Oraclize query was sent");
    }
}

/// @notice Called on ETH price update by Oraclize
function __callback(bytes32 myid, string result, bytes proof) public {
    require(msg.sender == oraclize_cbAddress());

    uint newPrice = parseInt(result).mul(100);

    m_ETHPriceUpdateRunning = false;
    if (newPrice >= m_ETHPriceLowerBound && newPrice <= m_ETHPriceUpperBound) {
        m_ETHPriceInCents = newPrice;
        m_ETHPriceLastUpdate = getTime();
        NewETHPrice(m_ETHPriceInCents);
        updateETHPriceInCents();
    } else {
        ETHPriceOutOfBounds(newPrice);
    }
}

/// @dev Check that double the update interval has passed
///      since last successful price update
function priceExpired() public view returns (bool) {
    return (getTime() > m_ETHPriceLastUpdate + 2 * m_ETHPriceUpdateInterval);
}

/// @notice unix timestamp of last update
uint public m_ETHPriceLastUpdate;

/// @dev Update ETH price in cents every hour
uint public m_ETHPriceUpdateInterval = 60*60;

/// @dev status of the price update
bool public m_ETHPriceUpdateRunning;
```

Note the initial state of ```m_ETHPriceUpdateRunning``` is ```false```, ```m_ETHPriceLastUpdate``` is ```0```. 
 ```priceExpired()``` returns ```true```  initially and will remain true until first callback comes from Oraclize 
 (at least for one hour after the presale is toped up), meaning ```updateETHPriceInCents()``` can be executed 
 successfully any number of times during this period.

This allows to schedule ```oraclize_query``` many times before first callback is received from Oraclize. 
 Once scheduled, a query to oraclize is resubmitted by a callback handler ```__callback``` once a callback 
 from Oraclize is received.

As the result, a limit of one query per hour to Oraclize to update ETH rate may be bypassed. 
 Once this happens the only way to go out of this behavior is by depletion of presale smart contract balance.

We've suggested fixing of this  mechanism for prohibiting of running multiple instances of 
 ```updateETHPriceInCents()```, and this was done in the latest commit.

## Unchangeable Dependency on CoinMarketCap API

```updateETHPriceInCents()``` in ```EthPriceDependent.sol``` depends on CoinMarketCap API, in particular on
```json(https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=USD).0.price_usd```,
which is both URL and data format dependent.

We recommend to consider a mechanism to update the API connection string, 
 or a mechanism to provide a fallback switch to another API if the API changes (URL, data format) 
 or becomes unavailable for an extended period of time.

## "Out of Bounds" Stop of Automatic Price Update

```__callback()``` function in ```EthPriceDependent.sol``` schedules next rate update by calling 
 ```updateETHPriceInCents``` only if ```ETHPriceOutOfBounds``` did not occur. Otherwise the rate update routine stops.

We've suggested to add an automatic recovery mechanism and this was done in the latest commit.

## "Out of Bounds" Token Price Vulnerability

Affected area: ```EthPriceDependent.sol```, ```BoomstarterPresale.buy()```

If ETH price drops suddenly below the ```m_ETHPriceLowerBound```, the sale is not stopped/paused which may cause 
 it to sell tokens for much lower value in USD then desired. 

We've suggested to consider implementing an automatic sale pause mechanism if ETH price drops 
 below the ```m_ETHPriceLowerBound```.

The change was made in the latest commit which affects this behaviour but doesn't fully resolve an issue:

If ETH price drops suddenly below the ```m_ETHPriceLowerBound```, the sale is not paused immediately, 
 but only after 12 hours pass, which may cause it to sell tokens for much lower value in USD 
 then desired during this period of time.

We're suggesting to consider implementing an automatic and immediate sale pause mechanism in response to abnormal 
 ETH price drop.


# Low Severity Vulnerabilities

## Logic Inconsistency in switchToNextSale()

Function ```switchToNextSale(address _nextSale)``` in ```BoomstarterToken.sol``` allows for an unsafe use if 
 ```msg.sender``` is equal to ```_nextSale```. 
 This has same effect as if ```_nextSale``` is equal to zero (which is prohibited by ```validAddress``` modifier).

We've recommended switching the two lines of function body
```
m_sales[_nextSale] = true;
m_sales[msg.sender] = false;
```
to
```
m_sales[msg.sender] = false;
m_sales[_nextSale] = true;
```

The fix was implemented in the latest commit.

## Unexpected Sale Behavior

Affected area: ```BoomstarterPresale.buy()```

Sale pauses if ETH price expired (last happened more than 24 hours ago). This behavior may be unexpected.

We're suggesting to document it in the technical requirements or any other document to be published.

## Possible Loss of the Callback from Oraclize

```EthPriceDependent.sol```

```m_leeway``` variable (possible timestamp inaccuracy) value ```30``` may be too small.
Consider increasing it to ```900```.
Values smaller may result in loss of the callback from Oraclize due to inaccuracy in ```now``` built in variable.

For reference, according to Block Protocol 2.0, accuracy for ```now``` is ```900``` seconds:

[https://ethereum.stackexchange.com/questions/6795/is-block-timestamp-safe-for-longer-time-periods]()

[https://github.com/ethereum/wiki/blob/c02254611f218f43cbb07517ca8e5d00fd6d6d75/Block-Protocol-2.0.md]()



# Line by Line Comments

## BoomstarterPresale.sol

1. buy() lines 109-116
   ```
   // price of 1 full token in ether-wei
   // example 30 * 1e18 / 36900 = 0.081 * 1e18 = 0.081 eth
   uint ethPerToken = centsPerToken.mul(1 ether).div(m_ETHPriceInCents);
   // change amount to maximum allowed
   tokenAmount = maxTokensAllowed;
   payment = ethPerToken.mul(tokenAmount).div(1 ether);
   ```
   can be simplified (unnecessary multiplication by 1 ETH followed by division by 1 ETH):
   ```
   // change amount to maximum allowed
   tokenAmount = maxTokensAllowed;
   payment = centsPerToken.mul(tokenAmount).div(m_ETHPriceInCents);
   ```

2. ```isContribution``` attribute of the event ```FundTransfer``` is always ```true```

3. lines 125-126 (fixed in latest commit)
   ```
   uint change;
   change = msg.value.sub(payment);
   ```
   can be combined into one line

   ```uint change = msg.value.sub(payment);```

   This was fixed in the latest commit.

4. Typo in word “overridden” in several places in comments. Its written as "overriden". Fixed in latest commit.

## BoomstarterToken.sol

1. ```payloadSizeIs``` modifier on ```transfer```, ```transferFrom```, ```burn``` may cause problems, please see
[https://blog.coinfabrik.com/smart-contract-short-address-attack-mitigation-failure/]()

Short address vulnerability should be left in responsibility of exchanges, trading a token.

The modifier was removed in latest commit.

2. Modifier ```validUnixTS``` is not used.

   The modifier was removed in latest commit.


## EthPriceDependent.sol

1. line 170: public variable ```m_leeway``` can be declared constant

2. line 167: public variable ```m_ETHPriceUpdateInterval``` can be declared constant


# Summary

Overall the code is well commented and clear on what it’s supposed to do for each function.

There are no critical vulnerabilities found in the smart contracts and deployment scripts audited.

The only medium severity vulnerability found was addressed and is fixed in the latest commit.

We'd recommend, though, to pay some additional attention to unresolved issues before releasing the private sale 
 into production.
