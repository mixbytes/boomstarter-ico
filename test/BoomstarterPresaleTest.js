'use strict';

import expectThrow from './helpers/expectThrow';
import {assertBigNumberEqual} from './helpers/asserts';

const BoomstarterTokenTestHelper = artifacts.require('BoomstarterTokenTestHelper.sol');
const BoomstarterPresaleTestHelper = artifacts.require('BoomstarterPresaleTestHelper.sol');

var boomstarterPresaleTestHelper;
var boomstarterTokenTestHelper;

var owners;
var beneficiary;
var buyers;
var nextIco;

const totalSupply = 36e24; //36m tokens
const production = false;

contract('BoomstarterPresale', async function(accounts) {
  
    it("init", async function() {
        owners = [ accounts[0], accounts[1], accounts[2] ];
        buyers = [ accounts[4], accounts[5], accounts[6] ];
        beneficiary = accounts[3];
        boomstarterTokenTestHelper = await BoomstarterTokenTestHelper.new(owners, 2);
        nextIco = await BoomstarterPresaleTestHelper.new(owners, boomstarterTokenTestHelper.address, beneficiary, production);
        boomstarterPresaleTestHelper = await BoomstarterPresaleTestHelper.new(owners, boomstarterTokenTestHelper.address, beneficiary, production);
        await boomstarterTokenTestHelper.transfer( boomstarterPresaleTestHelper.address, totalSupply, {from: owners[0]});
        await boomstarterTokenTestHelper.switchToNextSale( boomstarterPresaleTestHelper.address, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setTime( 1520000000 );
        // set eth price to $300
        await boomstarterPresaleTestHelper.setETHPriceManually( 30000, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setETHPriceManually( 30000, {from: owners[1]} );
        // set price switch to 7000 tokens
        await boomstarterPresaleTestHelper.setPriceRiseTokenAmount( 7000e18 );
        // set maximum amount of tokens sold during this sale, 15000 tokens
        await boomstarterPresaleTestHelper.setMaximumTokensSold( 15000e18 );
    });
    it("check basic buy", async function() {
        var initialBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(1, "ether")});
        var expectedAmountOfTokens = 300 * 1e18 / 0.3; // 1k bought out of 7k
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        // check amount of ether accepted by the external wallet
        var expectedEtherDifference = 1e18;
        var resultBeneficiaryAmount = await web3.eth.getBalance(beneficiary);
        assertBigNumberEqual(new web3.BigNumber(resultBeneficiaryAmount - initialBeneficiaryAmount),
                             new web3.BigNumber(expectedEtherDifference));
    });
    it("check buying during price rise", async function() {
        // should get 1 ether refund, but buyer also pays fee, so it's 
        // easier to check beneficiary balance
        var balanceBefore = await web3.eth.getBalance(beneficiary);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(7, "ether")});
        // together with the previous test it's going to be 1k + 7k > 7k threshold
        var expectedAmountOfTokens = 7000 * 1e18;
        assertBigNumberEqual(await boomstarterTokenTestHelper.balanceOf(buyers[0]), expectedAmountOfTokens);
        // external wallet balance should get 6k of ether
        var balanceAfter = await web3.eth.getBalance(beneficiary);
        var difference = balanceAfter.toNumber() - balanceBefore.toNumber();
        var expectedDifference = 6e18;
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
    });
    it("check that investing after dateTo doesn't work", async function() {
        await boomstarterPresaleTestHelper.setTime( 1530000000 );
        await expectThrow(boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(7, "ether")}));
        // return back to normal time
        await boomstarterPresaleTestHelper.setTime( 1520000000 );
    });
    it("check that investing less than the minimum doesn't work", async function() {
        var notEnoughEther = web3.toWei(0.0001, "ether");
        await expectThrow(boomstarterPresaleTestHelper.buy({from: buyers[0], value: notEnoughEther}));
    });
    it("check buying more than the limit allows", async function() {
        // set eth price to $200
        await boomstarterPresaleTestHelper.setETHPriceManually( 20000, {from: owners[0]} );
        await boomstarterPresaleTestHelper.setETHPriceManually( 20000, {from: owners[1]} );
        // should get 2 ether refund, but buyer also pays fee, so it's 
        // easier to check beneficiary balance
        var balanceBefore = await web3.eth.getBalance(beneficiary);
        var previousAmountOfTokens = await boomstarterTokenTestHelper.balanceOf(buyers[0]);
        await boomstarterPresaleTestHelper.buy({from: buyers[0], value: web3.toWei(30, "ether")});
        var resultingAmountOfTokens = await boomstarterTokenTestHelper.balanceOf(buyers[0]);
        var difference = resultingAmountOfTokens.toNumber() - previousAmountOfTokens.toNumber();
        var expectedDifference = 8000e18;
        var currentTokensSold = await boomstarterPresaleTestHelper.m_currentTokensSold();
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
        // external wallet balance will be increased by the amount
        // required to buy 7k tokens for the price of 40 cents each
        var balanceAfter = await web3.eth.getBalance(beneficiary);
        difference = balanceAfter.toNumber() - balanceBefore.toNumber();
        expectedDifference = 8000e18 * 0.4 / 200;
        assertBigNumberEqual(new web3.BigNumber(difference),
                             new web3.BigNumber(expectedDifference));
    });
    it("check price update", async function() {
        // running new update request with smaller update interval
        await boomstarterPresaleTestHelper.updateETHPriceInCents({value: web3.toWei(1, "ether")});

        var testUpdateStep = 5; //seconds
        console.log("waiting for the price");
        var manualPrice = 20000;
        function waitForPriceUpdate( resolve ) {
            boomstarterPresaleTestHelper.m_ETHPriceInCents().then( function( res ) {
                process.stdout.write(".");
                if ( res.toNumber() == manualPrice ) {
                    setTimeout( function() { waitForPriceUpdate( resolve ); }, testUpdateStep * 1000 );
                } else {
                    process.stdout.write("\n");
                    resolve( res );
                }
            });
        }

        await new Promise( function( resolve, reject ) {
            waitForPriceUpdate( resolve );
        });

        // cannot run update again as it's already running
        await expectThrow(boomstarterPresaleTestHelper.updateETHPriceInCents({value: web3.toWei(1, "ether")}));

        //cannot update price manually when it's just updated
        await boomstarterPresaleTestHelper.setETHPriceManually(10000, {from: owners[0]});
        await expectThrow(boomstarterPresaleTestHelper.setETHPriceManually(10000, {from: owners[1]}));
        //set impossible limits so that update stops
        await boomstarterPresaleTestHelper.setETHPriceUpperBound(10, {from: owners[0]});
        await boomstarterPresaleTestHelper.setETHPriceUpperBound(10, {from: owners[1]});

        var testnet = false;
        if (testnet) {
            //wait enough time and try to set again - double the update time
            console.log("waiting for price to expire");
            await new Promise( function( resolve, reject ) {
                setTimeout( function() { resolve(0); }, testUpdateStep*2*1000 ); 
            });
        } else {
            //skip double the update seconds + one additional 
            await boomstarterPresaleTestHelper.setTime( 1520000000 + testUpdateStep*3);
        }

        //now that price has expired update the price to any value
        await boomstarterPresaleTestHelper.setETHPriceManually(10000, {from: owners[0]});
        await boomstarterPresaleTestHelper.setETHPriceManually(10000, {from: owners[1]});

        //can run update again as it's stopped
        await boomstarterPresaleTestHelper.updateETHPriceInCents({value: web3.toWei(1, "ether")});

        //wait some more and set test-friendly price
        if (testnet) {
            //wait enough time and try to set again - double the update time
            console.log("waiting for price to expire");
            await new Promise( function( resolve, reject ) {
                setTimeout( function() { resolve(0); }, testUpdateStep*2*1000 ); 
            });
        } else {
            //skip one more double of update step + one additional step
            await boomstarterPresaleTestHelper.setTime( 1520000000 + testUpdateStep*6);
        }

        //now that price has expired update the price to any value
        await boomstarterPresaleTestHelper.setETHPriceManually(20000, {from: owners[0]});
        await boomstarterPresaleTestHelper.setETHPriceManually(20000, {from: owners[1]});
    });
    it("check finish sale", async function() {
        // increase the limit. Only possible in test helper
        await boomstarterPresaleTestHelper.setMaximumTokensSold( 20000e18 );
        // no next sale has been set, expect error (after multisig)
        await boomstarterPresaleTestHelper.finishSale({from:owners[0]});
        await expectThrow(boomstarterPresaleTestHelper.finishSale({from:owners[1]}));

        // set next sale
        await boomstarterPresaleTestHelper.setNextSale(nextIco.address, {from:owners[0]});
        await boomstarterPresaleTestHelper.setNextSale(nextIco.address, {from:owners[1]});

        // finish shouldn't work from non-owner users
        await expectThrow(boomstarterPresaleTestHelper.finishSale({from:buyers[0]}));
        await expectThrow(boomstarterPresaleTestHelper.finishSale({from:buyers[1]}));

        var tokensLeft = await boomstarterTokenTestHelper.balanceOf( boomstarterPresaleTestHelper.address );
        var etherLeft = await web3.eth.getBalance( boomstarterPresaleTestHelper.address );
        var etherDefault = await web3.eth.getBalance( nextIco.address );

        // finish from owners
        await boomstarterPresaleTestHelper.finishSale({from:owners[0]});
        await boomstarterPresaleTestHelper.finishSale({from:owners[1]});

        // nothing left in the previous sale contract
        assertBigNumberEqual( await boomstarterTokenTestHelper.balanceOf( boomstarterPresaleTestHelper.address ), new web3.BigNumber(0) );
        assertBigNumberEqual( await web3.eth.getBalance( boomstarterPresaleTestHelper.address ), new web3.BigNumber(0) );

        // everything has been transferred to the new sale contract
        assertBigNumberEqual( await boomstarterTokenTestHelper.balanceOf( nextIco.address ), tokensLeft );
        assertBigNumberEqual( await web3.eth.getBalance( nextIco.address ), new web3.BigNumber(etherDefault.toNumber() + etherLeft.toNumber()) );
    });
});
