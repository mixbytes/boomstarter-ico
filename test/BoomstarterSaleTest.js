'use strict';

import expectThrow from './helpers/expectThrow';
import {assertBigNumberEqual} from './helpers/asserts';
import {withRollback} from './helpers/EVMSnapshots';

const BoomstarterTokenTestHelper = artifacts.require('BoomstarterTokenTestHelper.sol');
const BoomstarterICOTestHelper = artifacts.require('BoomstarterICOTestHelper.sol');
const BoomstarterSaleTestHelper = artifacts.require('BoomstarterSaleTestHelper.sol');
const FundsRegistry = artifacts.require('FundsRegistry.sol');
const ReenterableMinter = artifacts.require('ReenterableMinter.sol');

var boomstarterTokenTestHelper;

var owners;
var beneficiary;
var buyers;
var sale;
var ico;
var fundsRegistry;
var oldMinter;
var minter;

const BN = (n) => new web3.BigNumber(n);

const totalSupply = 36e24; //36m tokens
const production = false;
var icoTokensSold = BN(0);

var icoTime =     1538341198;
var currentTime = 1537800986;
var timeStep =        604800;

contract('BoomstarterSale', async function(accounts) {
  
    it("init ico", async function() {
        owners = [ accounts[0], accounts[1], accounts[2] ];
        buyers = [ accounts[4], accounts[5], accounts[6] ];
        beneficiary = accounts[3];

        // create Token
        boomstarterTokenTestHelper = await BoomstarterTokenTestHelper.new(owners, 2, {from: owners[0]});

        // create ICO
        ico = await BoomstarterICOTestHelper.new(owners, boomstarterTokenTestHelper.address, production);
        await boomstarterTokenTestHelper.transfer(ico.address, totalSupply, {from: owners[0]});
        await boomstarterTokenTestHelper.switchToNextSale(ico.address, {from: owners[0]});
        await ico.setTime(icoTime);

        // set eth price to $300
        await ico.setETHPriceManually(30000, {from: owners[0]});
        await ico.setETHPriceManually(30000, {from: owners[1]});
        await ico.topUp({value: web3.toWei(200, "finney")});

        // create Funds Registry
        fundsRegistry = await FundsRegistry.new(owners, 2, ico.address, boomstarterTokenTestHelper.address);
        await boomstarterTokenTestHelper.setSale(fundsRegistry.address, true, {from: owners[0]});
        await boomstarterTokenTestHelper.setSale(fundsRegistry.address, true, {from: owners[1]});
        await ico.init(fundsRegistry.address, beneficiary, 100000, {from: owners[0]});
        await ico.init(fundsRegistry.address, beneficiary, 100000, {from: owners[1]});

        assert.equal(await ico.m_tokenDistributor(), beneficiary);

        // create Minter
        oldMinter = await ReenterableMinter.new(ico.address, {from: owners[0]});
        await ico.setNonEtherController(oldMinter.address, {from: owners[0]});
        await ico.setNonEtherController(oldMinter.address, {from: owners[1]});
    });

    it("buy some tokens during ico", async function() {
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), 0);
        assertBigNumberEqual(await web3.eth.getBalance(fundsRegistry.address), web3.toWei(0, "ether"));

        await ico.buy({from: buyers[0], value: web3.toWei(1, "ether")});

        const tokens = new web3.BigNumber(web3.toWei(1, "ether")).mul(300).div(2);
        icoTokensSold = icoTokensSold.add(tokens);
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), tokens);

        // check amount of ether collected
        assertBigNumberEqual(await web3.eth.getBalance(fundsRegistry.address), web3.toWei(1, "ether"));
        assertBigNumberEqual(await web3.eth.getBalance(ico.address), web3.toWei(200, "finney"));
    });

    it("buy with bitcoin during ico", async function() {
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), 0);

        await oldMinter.mint(1, buyers[1], web3.toWei(2, "ether"), {from: owners[0]});

        const tokens = new web3.BigNumber(web3.toWei(2, "ether")).mul(300).div(2);
        icoTokensSold = icoTokensSold.add(tokens);
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), tokens);

        // check amount of ether collected
        assertBigNumberEqual(await web3.eth.getBalance(fundsRegistry.address), web3.toWei(1, "ether"),
                "balance must stay unchanged (bitcoin payment)");
        assertBigNumberEqual(await web3.eth.getBalance(ico.address), web3.toWei(200, "finney"));
    });

    it("migrate to sale", async function() {
        // 1
        sale = await BoomstarterSaleTestHelper.new(owners, boomstarterTokenTestHelper.address, production);
        await sale.setTime(icoTime);
        // 2
        await sale.setETHPriceManually(30000, {from: owners[0]});
        await sale.setETHPriceManually(30000, {from: owners[1]});
        await sale.topUp({value: web3.toWei(200, "finney")});
        // 3
        await boomstarterTokenTestHelper.setSale(sale.address, true, {from: owners[0]});
        await boomstarterTokenTestHelper.setSale(sale.address, true, {from: owners[1]});

        // 4
        minter = await ReenterableMinter.new(sale.address, {from: owners[0]});
        // 5
        await minter.transferOwnership(owners[2], {from: owners[0]});
        // 6
        assertBigNumberEqual(await sale.m_state(), 0);  // INIT
        await sale.setNonEtherController(minter.address, {from: owners[0]});
        await sale.setNonEtherController(minter.address, {from: owners[1]});

        // 7
        // -
        // 8
        await ico.pause({from: owners[0]});

        // 9
        await fundsRegistry.setController(sale.address, {from: owners[0]});
        await fundsRegistry.setController(sale.address, {from: owners[1]});
        // 10
        await ico.applyHotFix(sale.address, {from: owners[0]});
        await ico.applyHotFix(sale.address, {from: owners[1]});
        // 11
        await sale.init(fundsRegistry.address, beneficiary, {from: owners[0]});
        await sale.init(fundsRegistry.address, beneficiary, {from: owners[1]});

        // checking balance transfer
        assertBigNumberEqual(await web3.eth.getBalance(ico.address), web3.toWei(0, "finney"));
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(ico.address), 0);

        assertBigNumberEqual(await web3.eth.getBalance(sale.address), web3.toWei(400, "finney"));
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(sale.address),
                BN(totalSupply).sub(icoTokensSold));

        // checking links
        assert.equal(await fundsRegistry.m_controller(), sale.address);
        assert.equal(await sale.m_tokenDistributor(), beneficiary);
        assert.equal(await sale.m_funds(), fundsRegistry.address);
        assert.equal(await sale.m_token(), boomstarterTokenTestHelper.address);

        // checking states
        assertBigNumberEqual(await sale.m_state(), 1);  // ACTIVE
        assertBigNumberEqual(await fundsRegistry.m_state(), 0);     // GATHERING

        // checking other fields
        assertBigNumberEqual(await sale.m_currentTokensSold(), 0);
        assertBigNumberEqual(await sale.c_maximumTokensSold(), BN(totalSupply).mul(75).div(100).sub(icoTokensSold));
    });

/*    it("buy some from ico during first stage with ether", async function() {

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // move to the first price
        currentTime += timeStep;
        await ico.setTime( currentTime );
        await ico.setETHPriceManually( 30000, {from: owners[0]} );
        await ico.setETHPriceManually( 30000, {from: owners[1]} );

        // buy cheap
        await ico.buy({from: buyers[1], value: web3.toWei(2, "ether")});

        // first stage, first price
        var expectedAmountOfTokens = 300 * 2e18 / 0.8; // 750 bought
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
        // check amount of ether accepted by the funds registry
        var expectedEtherDifference = 2e18;
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("buy some from ico during first stage without ether", async function() {
        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // set controller for non-ether purchase
        ico.setNonEtherController(owners[1], {from: owners[0]});
        ico.setNonEtherController(owners[1], {from: owners[1]});

        // not-controller cannot make non-ether purchase
        await expectThrow(ico.nonEtherBuy(buyers[1], web3.toWei(3, "ether"), {from: owners[0]}));

        // controller can make non-ether purchase
        await ico.nonEtherBuy(buyers[1], web3.toWei(3, "ether"), {from: owners[1]});

        // ether shouldn't change
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount), 0);

        // token amount should still change
        var expectedAmountOfTokens = 300 * 5e18 / 0.8; // 750 + 1125

        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
    });
    it("buy some from ico during second stage with ether", async function() {

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // move to the second price (double the step since the first interval is ~ 2 weeks)
        currentTime += timeStep*2;
        await ico.setTime( currentTime );
        await ico.setETHPriceManually( 30000, {from: owners[0]} );
        await ico.setETHPriceManually( 30000, {from: owners[1]} );

        // buy a bit more expensive
        await ico.buy({from: buyers[1], value: web3.toWei(2, "ether")});

        // first stage, first price
        var expectedAmountOfTokens = 300 * 5e18 / 0.8 + 300 * 2e18 / 1; // 600 + 750 + 1125
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens);
        // check amount of ether accepted by the funds registry
        var expectedEtherDifference = 2e18;
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("buy some with bonus", async function() {

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // move to the second price
        currentTime += timeStep;
        await ico.setTime( currentTime );

        // set eth price to $10k
        await ico.setETHPriceManually( 1000000, {from: owners[0]} );
        await ico.setETHPriceManually( 1000000, {from: owners[1]} );

        // buy enough to get bonus
        await ico.buy({from: buyers[1], value: web3.toWei(5, "ether")});

        // buy additional tokens with bonus
        var expectedAmountOfTokens = 300 * 5e18 / 0.8 + 300 * 2e18 / 1 + 10000 * 5e18; // 600 + 750 + 1125 + ...

        assert.equal(await boomstarterTokenTestHelper.balanceOf(buyers[1]), expectedAmountOfTokens, "wrong token balance: got {0}".format(expectedAmountOfTokens));

        // check amount of ether accepted by the funds registry
        var expectedEtherDifference = 5e18;
        var resultAmount = await web3.eth.getBalance(fundsRegistry.address);
        assertBigNumberEqual(new web3.BigNumber(resultAmount - initialAmount),
        new web3.BigNumber(expectedEtherDifference));
    });
    it("finish-success", async function() {

        await ico.setCap(50000); // assume just $500 is enough

        // time is up
        currentTime += timeStep * 10;
        await ico.setTime(currentTime);

        var initialAmount = await web3.eth.getBalance(fundsRegistry.address);

        // try to get refund before finish
        await expectThrow(fundsRegistry.withdrawPayments({from: buyers[1]}));

        var icoTokensLeft = await boomstarterTokenTestHelper.balanceOf(ico.address);

        // call anything to trigger finish
        await ico.pause();

        var investorTokens = await boomstarterTokenTestHelper.balanceOf(buyers[1]);

        // approve full token balance
        await boomstarterTokenTestHelper.approve(fundsRegistry.address, investorTokens, {from: buyers[1]});

        // now the refund shouldn't succeed because the ico was successful
        await expectThrow(fundsRegistry.withdrawPayments({from: buyers[1]}));

        // after finish ico should send all tokens to beneficiary account
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(ico.address), 0);

        // all tokens transferred to pool allocator account
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(beneficiary), icoTokensLeft)

        var originalOwnerBalance = await web3.eth.getBalance(owners[2]);

        // owners can withdraw ether from fundsRegistry after ico succeeds
        await fundsRegistry.sendEther(owners[2], 5e18, {from: owners[0]});
        await fundsRegistry.sendEther(owners[2], 5e18, {from: owners[1]});

        var newOwnerBalance = await web3.eth.getBalance(owners[2]);

        assertBigNumberEqual(new web3.BigNumber(newOwnerBalance - originalOwnerBalance), 5e18);
    });*/
});
