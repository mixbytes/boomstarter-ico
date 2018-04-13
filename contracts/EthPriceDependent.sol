pragma solidity 0.4.19;

import "./oraclize/usingOraclize.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "mixbytes-solidity/contracts/ownership/multiowned.sol";

contract EthPriceDependent is usingOraclize, multiowned {

    using SafeMath for uint256;

    event NewOraclizeQuery(string description);
    event NewETHPrice(uint price);
    event ETHPriceOutOfBounds(uint price);

    /// @notice Constructor
    /// @param _initialOwners set owners, which can control bounds and things
    ///        described in the actual sale contract, inherited from this one
    /// @param _consensus Number of votes enough to make a decision
    function EthPriceDependent(address[] _initialOwners,  uint _consensus)
        public
        multiowned(_initialOwners, _consensus)
    {
        m_ETHPriceUpdateRunning = false;
        bool bridge = true; // should be false in production
        oraclize_setProof(proofType_TLSNotary | proofStorage_IPFS);
        if (bridge) {
          // Use it when testing with testrpc and etherium bridge. Don't forget to change address
          OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
        } else {
          // Don't call this while testing as it's too long and gets in the way
          updateETHPriceInCents();
        }
    }

    /// @notice Send oraclize query.
    /// if price is received successfully - update scheduled automatically,
    /// if at any point the contract runs out of ether - updating stops and further
    /// updating will require running this function again.
    /// if price is out of bounds - updating stops
    function updateETHPriceInCents() public payable {
        // prohibit running multiple instances of update
        require(m_ETHPriceUpdateRunning = false ||
                (getTime() > m_ETHPriceLastUpdate + 2 * m_ETHPriceUpdateInterval));
        if (oraclize_getPrice("URL") > this.balance) {
            NewOraclizeQuery("Oraclize request fail. Not enough ether");
        } else {
            NewOraclizeQuery("Oraclize query was sent");
            oraclize_query(
                m_ETHPriceUpdateInterval,
                "URL",
                "json(https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=USD).0.price_usd"
            );
            m_ETHPriceUpdateRunning = true;
        }
    }

    /// @notice Called on ETH price update by Oraclize
    function __callback(bytes32 myid, string result, bytes proof) public {
        require(msg.sender == oraclize_cbAddress());

        uint newPrice = parseInt(result).mul(100);

        if (newPrice > m_ETHPriceLowerBound && newPrice < m_ETHPriceUpperBound) {
            m_ETHPriceInCents = newPrice;
            m_ETHPriceLastUpdate = getTime();
            NewETHPrice(m_ETHPriceInCents);
            updateETHPriceInCents();
        } else {
            ETHPriceOutOfBounds(newPrice);
            m_ETHPriceUpdateRunning = false;
        }
    }

    /// @notice set the limit of ETH in cents, oraclize data greater than this is not accepted
    /// @param _price Price in US cents
    function setETHPriceUpperBound(uint _price)
        external
        onlymanyowners(keccak256(msg.data))
    {
        m_ETHPriceUpperBound = _price;
    }

    /// @notice set the limit of ETH in cents, oraclize data smaller than this is not accepted
    /// @param _price Price in US cents
    function setETHPriceLowerBound(uint _price)
        external
        onlymanyowners(keccak256(msg.data))
    {
        m_ETHPriceLowerBound = _price;
    }

    /// @notice set the price of ETH in cents, called in case we don't get oraclize data
    ///         for more than double the update interval
    /// @param _price Price in US cents
    function setETHPriceManually(uint _price)
        external
        onlymanyowners(keccak256(msg.data))
    {
        require(getTime() > m_ETHPriceLastUpdate + 2 * m_ETHPriceUpdateInterval);
        m_ETHPriceInCents = _price;
    }

    /// @dev to be overriden in tests
    function getTime() internal view returns (uint) {
        return now;
    }

    // FIELDS

    /// @notice usd price of ETH in cents, retrieved using oraclize
    uint public m_ETHPriceInCents = 0;
    /// @notice unix timestamp of last update
    uint public m_ETHPriceLastUpdate;

    /// @notice lower bound of the ETH price in cents
    uint public m_ETHPriceLowerBound = 100;
    /// @notice upper bound of the ETH price in cents
    uint public m_ETHPriceUpperBound = 100000000;

    /// @dev Update ETH price in cents every hour
    uint public m_ETHPriceUpdateInterval = 60*60;

    /// @dev status of the price update
    bool public m_ETHPriceUpdateRunning;
}
