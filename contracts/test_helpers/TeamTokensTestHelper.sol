pragma solidity 0.4.23;

import '../crowdsale/TeamTokens.sol';

/// @title Helper for unit-testing TeamTokens - DONT use in production!
contract TeamTokensTestHelper is TeamTokens {

    function TeamTokensTestHelper(address[] _owners, uint _signaturesRequired, address _ico, address _token)
        TeamTokens(_owners, _signaturesRequired, _ico, _token) {}


    function setTime(uint time) public {
        m_time = time;
    }

    function getTime() internal view returns (uint) {
        return m_time;
    }

    uint public m_time;
}
