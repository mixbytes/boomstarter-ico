pragma solidity 0.4.23;

import "./EthPriceDependent.sol";

contract EthPriceDependentForICO is EthPriceDependent {

    /// @dev overridden price lifetime logic
    function priceExpired() public view returns (bool) {
        return 0 == m_ETHPriceInCents;
    }
}
