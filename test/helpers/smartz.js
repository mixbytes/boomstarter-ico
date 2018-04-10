
// converts amount of SMR token into token-wei (smallest token units)
export function SMR(amount) {
    return web3.toWei(amount, 'ether');
}

// converts amount of SMRE token into token-wei (smallest token units)
export function SMRE(amount) {
    return amount * 100;
}
