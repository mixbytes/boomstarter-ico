pragma solidity 0.4.19;

import '../BoomstarterToken.sol';


/// @title Helper for unit-testing BoomstarterToken - DONT use in production!
contract BoomstarterTokenTestHelper is BoomstarterToken {

    function BoomstarterTokenTestHelper(address[] _initialOwners, uint _signaturesRequired)
        public
        BoomstarterToken(_initialOwners, _signaturesRequired)
    {
    }

    function setTime(uint time) public {
        m_time = time;
    }

    function getTime() internal view returns (uint) {
        return m_time;
    }

    uint public m_time;
}
