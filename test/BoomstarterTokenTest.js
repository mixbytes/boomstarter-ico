'use strict';

import {tokenUTest} from './utest/Token';
import {l} from './helpers/debug';
import expectThrow from './helpers/expectThrow';
import {assertBigNumberEqual} from './helpers/asserts';
import {withRollback} from './helpers/EVMSnapshots';

const BoomstarterToken = artifacts.require('BoomstarterToken.sol');
const BoomstarterTokenTestHelper = artifacts.require('BoomstarterTokenTestHelper.sol');
const TestApprovalRecipient = artifacts.require('TestApprovalRecipient.sol');

const totalSupply = 36e6;

async function instantiate(role, initial_balances_map) {
    const token = await BoomstarterToken.new([role.owner1], 1, {from: role.nobody});

    for (const to_ in initial_balances_map)
        await token.transfer(to_, initial_balances_map[to_], {from: role.nobody});

    const remaining = await token.balanceOf(role.nobody);
    await token.burn(remaining, {from: role.nobody});

    return token;
}

/* for testing regular token functions after the end of ICO (all tokens unfrozen) */
async function instantiateUnfrozen(role, initial_balances_map) {
    const token = await BoomstarterToken.new([role.owner1], 1, {from: role.nobody});

    for (const to_ in initial_balances_map)
        await token.transfer(to_, initial_balances_map[to_], {from: role.nobody});

    const remaining = await token.balanceOf(role.nobody);
    await token.burn(remaining, {from: role.nobody});

    await token.thaw({from: role.owner1});
    return token;
}


// converts amount of token into token-wei (smallest token units)
function BMTS(amount) {
    return web3.toWei(amount, 'ether');
}

contract('BoomstarterTokenTest', function(accounts) {

    for (const [name, fn] of tokenUTest(accounts, instantiateUnfrozen, {
        burnable: true
    })) {
         it(name, fn);
    }

    it('test approveAndCall', async function() {
        const owner1 = accounts[0];
        const owner2 = accounts[1];
        const nobody = accounts[2];

        const initial_balances_map = {};
        initial_balances_map[owner1] = BMTS(10);
        initial_balances_map[owner2] = BMTS(3);

        const role = {owner1, nobody};
        const token = await instantiateUnfrozen(role, initial_balances_map);
        const recipient = await TestApprovalRecipient.new(token.address, {from: nobody});

        await token.approveAndCall(recipient.address, BMTS(1), '', {from: owner1});
        assertBigNumberEqual(await recipient.m_bonuses(owner1), BMTS(1));

        await token.approveAndCall(recipient.address, BMTS(1), '0x4041', {from: owner2});
        assertBigNumberEqual(await recipient.m_bonuses(owner2), BMTS(2));
        assertBigNumberEqual(await token.balanceOf(owner2), BMTS(2));   // 3 - 1
    });

    it('test full lifecycle', async function() {
        const owner1 = accounts[0];
        const owner2 = accounts[1];
        const owner3 = accounts[2];
        const holder1 = accounts[2];  // owner receives some tokens case
        const holder2 = accounts[3];
        const holder3 = accounts[4];
        const ico = accounts[5];
        const nobody = accounts[6];

        // constructing token
        const token = await BoomstarterTokenTestHelper.new([owner1, owner2, owner3], 2, {from: owner1});
        assertBigNumberEqual(await token.balanceOf(owner1), BMTS(totalSupply));
        assertBigNumberEqual(await token.totalSupply(), BMTS(totalSupply));
        // NOTE: owner1 already has sale role (set in constructor)

        // early investment
        await token.transfer(holder2, BMTS(40), {from: owner1});
        assertBigNumberEqual(await token.balanceOf(holder2), BMTS(40));
        await expectThrow(token.transfer(nobody, BMTS(1), {from: holder2}));  // can't sell yet

        // ok, now it's ico time
        await token.transfer(ico, BMTS(1e6), {from: owner1});
        await token.setSale(ico, true, {from: owner1});
        await token.setSale(ico, true, {from: owner2});  // 2nd signature

        // minting by ico to an holder
        await token.transfer(holder1, BMTS(20), {from: ico});
        assertBigNumberEqual(await token.balanceOf(holder1), BMTS(20));

        await expectThrow(token.transfer(nobody, BMTS(1), {from: holder1}));  // both holders..
        await expectThrow(token.transfer(nobody, BMTS(1), {from: holder2}));  // ..can neither sell
        await expectThrow(token.burn(BMTS(1), {from: holder1})); // nor burn yet
        await expectThrow(token.burn(BMTS(1), {from: holder2})); //

        // switching between different icos can only be done by an account with the 'sale' role
        await expectThrow(token.switchToNextSale(holder1, {from: holder2}));
        // and when switch is called the role of current account is revoked
        await token.switchToNextSale(holder1, {from: ico});
        await expectThrow(token.switchToNextSale(holder2, {from:ico}));
        // new sale has all the rights now, including switching
        await token.switchToNextSale(ico, {from: holder1});

        // holder3
        await token.transfer(holder3, BMTS(10), {from: ico});
        assertBigNumberEqual(await token.balanceOf(holder3), BMTS(10));
        await expectThrow(token.transfer(nobody, BMTS(1), {from: holder3}));

        // refund frozen tokens
        // first attempt - not approved
        await expectThrow(token.transferFrom(holder3, ico, BMTS(10), {from: ico}));
        // approve and transferFrom
        await token.approve(ico, BMTS(10), {from: holder3});
        await token.transferFrom(holder3, ico, BMTS(10), {from: ico});
        assertBigNumberEqual(await token.balanceOf(holder3), BMTS(0));
        // revert back for further testing
        await token.transfer(holder3, BMTS(10), {from:ico});

        // ico is over - one of the owners decided to unfreeze tokens
        await token.thaw({from: owner1});
        // but that's not enough to actually unfreeze them
        await expectThrow(token.transfer(nobody, BMTS(1), {from: holder1}));
        // now one more owner unfreezes tokens
        await token.thaw({from: owner2});
        // now everyone can use their tokens as usual
        await token.transfer(nobody, BMTS(1), {from: holder1});
        await token.transfer(nobody, BMTS(1), {from: holder2});
        // and burn as well
        var burntNumber = 1;
        await token.burn(BMTS(burntNumber), {from: holder2});

        assertBigNumberEqual(await token.balanceOf(nobody), BMTS(2));
        assertBigNumberEqual(await token.balanceOf(holder2), BMTS(39 - burntNumber));

        assertBigNumberEqual(await token.balanceOf(holder1), BMTS(19));

        // refund
        // first attempt - not approved
        await expectThrow(token.transferFrom(holder3, ico, BMTS(10), {from: ico}));

        await token.approve(ico, BMTS(10), {from: holder3});
        await token.transferFrom(holder3, ico, BMTS(10), {from: ico});
        assertBigNumberEqual(await token.balanceOf(holder3), BMTS(0));
        await expectThrow(token.transfer(nobody, BMTS(1), {from: holder3}));

        // no more privileged calls, one signature
        await token.disablePrivileged({from: owner1});

        // owner still can call setSale
        await token.setSale(holder2, true, {from: owner1});

        // remaining signature
        await token.disablePrivileged({from: owner2});  // 2nd signature

        // owner cannot setSale anymore
        await expectThrow(token.setSale(holder2, true, {from: owner2}));

        // totals
        assertBigNumberEqual(await token.totalSupply(), BMTS(totalSupply - burntNumber));
        let sum = new web3.BigNumber(0);
        for (const role of [owner1, owner2, holder1, holder2, holder3, ico, nobody])
            sum = sum.add(await token.balanceOf(role));
        assertBigNumberEqual(sum, BMTS(totalSupply - burntNumber));
    });
});
