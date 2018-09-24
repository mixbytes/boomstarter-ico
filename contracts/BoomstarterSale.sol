pragma solidity 0.4.23;

import 'mixbytes-solidity/contracts/security/ArgumentsChecker.sol';
import 'mixbytes-solidity/contracts/crowdsale/FixedTimeBonuses.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import './EthPriceDependentForICO.sol';
import './crowdsale/FundsRegistry.sol';
import './IBoomstarterToken.sol';
import '../minter-service/contracts/IICOInfo.sol';
import '../minter-service/contracts/IMintableToken.sol';


contract BoomstarterSale is ArgumentsChecker, ReentrancyGuard, EthPriceDependentForICO, IICOInfo, IMintableToken {
    using FixedTimeBonuses for FixedTimeBonuses.Data;

    enum IcoState { INIT, ACTIVE, PAUSED, FAILED, SUCCEEDED }

    event StateChanged(IcoState _state);
    event FundTransfer(address backer, uint amount, bool isContribution);


    modifier requiresState(IcoState _state) {
        require(m_state == _state);
        _;
    }

    /// @dev triggers some state changes based on current time
    /// @param client optional refund parameter
    /// @param payment optional refund parameter
    /// @param refundable - if false, payment is made off-chain and shouldn't be refunded
    /// note: function body could be skipped!
    modifier timedStateChange(address client, uint payment, bool refundable) {
        if (IcoState.INIT == m_state && getTime() >= getStartTime())
            changeState(IcoState.ACTIVE);

        if (IcoState.ACTIVE == m_state && getTime() >= getFinishTime()) {
            finishICOInternal();

            if (refundable && payment > 0)
                client.transfer(payment);
            // note that execution of further (but not preceding!) modifiers and functions ends here
        } else {
            _;
        }
    }

    /// @dev automatic check for unaccounted withdrawals
    /// @param client optional refund parameter
    /// @param payment optional refund parameter
    /// @param refundable - if false, payment is made off-chain and shouldn't be refunded
    modifier fundsChecker(address client, uint payment, bool refundable) {
        uint atTheBeginning = m_funds.balance;
        if (atTheBeginning < m_lastFundsAmount) {
            changeState(IcoState.PAUSED);
            if (refundable && payment > 0)
                client.transfer(payment);     // we cant throw (have to save state), so refunding this way
            // note that execution of further (but not preceding!) modifiers and functions ends here
        } else {
            _;

            if (m_funds.balance < atTheBeginning) {
                changeState(IcoState.PAUSED);
            } else {
                m_lastFundsAmount = m_funds.balance;
            }
        }
    }

    function estimate(uint256 _wei) public view returns (uint tokens) {
        uint amount;
        (amount, ) = estimateTokensWithActualPayment(_wei);
        return amount;
    }

    function isSaleActive() public view returns (bool active) {
        return m_state == IcoState.ACTIVE && !priceExpired();
    }

    function purchasedTokenBalanceOf(address addr) public view returns (uint256 tokens) {
        return m_token.balanceOf(addr);
    }

    function getTokenBonus() public view returns (uint percent) {
        if (getTime() < 1538341200)     // OCT 1
            return 0;
        if (getTime() >= getFinishTime())
            return 0;

        return m_tokenBonuses.getBonus(getTime());
    }

    function ether2tokens(uint ether_) public view returns (uint) {
        return ether_.mul(m_ETHPriceInCents).div(c_tokenPriceInCents).mul(getTokenBonus().add(100)).div(100);
    }

    function tokens2ether(uint tokens) public view returns (uint) {
        return tokens.mul(100).div(getTokenBonus().add(100)).mul(c_tokenPriceInCents).div(m_ETHPriceInCents);
    }

    function estimateTokensWithActualPayment(uint256 _payment) public view returns (uint amount, uint actualPayment) {
        // amount of bought tokens
        uint tokens = ether2tokens(_payment);

        if (tokens.add(m_currentTokensSold) > c_maximumTokensSold) {
            tokens = c_maximumTokensSold.sub( m_currentTokensSold );
            _payment = tokens2ether(tokens);
        }

        return (tokens, _payment);
    }


    // PUBLIC interface

    /**
     * @dev constructor
     * @param _owners addresses to do administrative actions
     * @param _token address of token being sold
     * @param _updateInterval time between oraclize price updates in seconds
     * @param _production false if using testrpc/ganache, true otherwise
     */
    constructor(
        address[] _owners,
        address _token,
        uint _updateInterval,
        bool _production
    )
        public
        payable
        EthPriceDependent(_owners, 2, _production)
        validAddress(_token)
    {
        require(3 == _owners.length);

        m_token = IBoomstarterToken(_token);
        m_ETHPriceUpdateInterval = _updateInterval;
        m_startTime = getTime();
        oraclize_setCustomGasPrice(40*1000*1000*1000);

        m_tokenBonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1538946000 - 1, bonus: 25}));   // up to OCT 8
        m_tokenBonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1539550800 - 1, bonus: 15}));   // up to OCT 15
        m_tokenBonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1540155600 - 1, bonus: 10}));   // up to OCT 22
        m_tokenBonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1541019600 - 1, bonus: 5}));    // up to NOV 1
        m_tokenBonuses.bonuses.push(FixedTimeBonuses.Bonus({endTime: 1853960400 - 1, bonus: 0}));    // up to 2028 OCT 1
        m_tokenBonuses.validate(true);
    }

    /// @dev set addresses for ether and token storage
    ///      performed once by deployer
    /// @param _funds FundsRegistry address
    /// @param _tokenDistributor address to send remaining tokens to after ICO
    function init(address _funds, address _tokenDistributor)
        external
        validAddress(_funds)
        validAddress(_tokenDistributor)
        onlymanyowners(keccak256(msg.data))
    {
        require(m_token.balanceOf(this) > 0);   // tokens must be transferred beforehand

        // can be set only once
        require(m_funds == address(0));
        m_funds = FundsRegistry(_funds);

        // calculate remaining tokens and leave 25% for manual allocation
        c_maximumTokensSold = m_token.balanceOf(this).sub( m_token.totalSupply().div(4) );

        // set account that allocates the rest of tokens after ico succeeds
        m_tokenDistributor = _tokenDistributor;
    }


    // PUBLIC interface: payments

    // fallback function as a shortcut
    function() payable {
        require(0 == msg.data.length);
        buy();  // only internal call here!
    }

    /// @notice ICO participation
    function buy() public payable {     // dont mark as external!
        internalBuy(msg.sender, msg.value, true);
    }

    function mint(address client, uint256 ethers) public {
        nonEtherBuy(client, ethers);
    }


    /// @notice register investments coming in different currencies
    /// @dev can only be called by a special controller account
    /// @param client Account to send tokens to
    /// @param etherEquivalentAmount Amount of ether to use to calculate token amount
    function nonEtherBuy(address client, uint etherEquivalentAmount)
        public
    {
        require(msg.sender == m_nonEtherController);
        // just to check for input errors
        require(etherEquivalentAmount <= 70000 ether);
        internalBuy(client, etherEquivalentAmount, false);
    }

    /// @dev common buy for ether and non-ether
    /// @param client who invests
    /// @param payment how much ether
    /// @param refundable true if invested in ether - using buy()
    function internalBuy(address client, uint payment, bool refundable)
        internal
        nonReentrant
        timedStateChange(client, payment, refundable)
        fundsChecker(client, payment, refundable)
    {
        // don't allow to buy anything if price change was too long ago
        // effectively enforcing a sale pause
        require( !priceExpired() );
        require(m_state == IcoState.ACTIVE || m_state == IcoState.INIT && isOwner(client) /* for final test */);

        require((payment.mul(m_ETHPriceInCents)).div(1 ether) >= c_MinInvestmentInCents);


        uint actualPayment = payment;
        uint tokens;

        (tokens, actualPayment) = estimateTokensWithActualPayment(payment);


        // change ICO investment stats
        m_currentTokensSold = m_currentTokensSold.add(tokens);

        // send bought tokens to the client
        m_token.transfer(client, tokens);

        assert(m_currentTokensSold <= c_maximumTokensSold);

        if (refundable) {
            // record payment if paid in ether
            m_funds.invested.value(actualPayment)(client, tokens);
            emit FundTransfer(client, actualPayment, true);
        }

        // check if ICO must be closed early
        if (payment.sub(actualPayment) > 0) {
            assert(c_maximumTokensSold == m_currentTokensSold);
            finishICOInternal();

            // send change
            client.transfer(payment.sub(actualPayment));
        } else if (c_maximumTokensSold == m_currentTokensSold) {
            finishICOInternal();
        }
    }


    // PUBLIC interface: misc getters

    /// @notice start time of the ICO
    function getStartTime() public view returns (uint) {
        return m_startTime;
    }

    /// @notice finish time of the ICO
    function getFinishTime() public view returns (uint) {
        return m_tokenBonuses.getLastTime();
    }


    // PUBLIC interface: owners: maintenance

    /// @notice pauses ICO
    function pause()
        external
        timedStateChange(address(0), 0, true)
        requiresState(IcoState.ACTIVE)
        onlyowner
    {
        changeState(IcoState.PAUSED);
    }

    /// @notice resume paused ICO
    function unpause()
        external
        timedStateChange(address(0), 0, true)
        requiresState(IcoState.PAUSED)
        onlymanyowners(keccak256(msg.data))
    {
        changeState(IcoState.ACTIVE);
        checkTime();
    }

    /// @notice withdraw tokens if ico failed
    /// @param _to address to send tokens to
    /// @param _amount amount of tokens in token-wei
    function withdrawTokens(address _to, uint _amount)
        external
        validAddress(_to)
        requiresState(IcoState.FAILED)
        onlymanyowners(keccak256(msg.data))
    {
        require((_amount > 0) && (m_token.balanceOf(this) >= _amount));
        m_token.transfer(_to, _amount);
    }

    /// @notice In case we need to attach to existent funds
    function setFundsRegistry(address _funds)
        external
        validAddress(_funds)
        timedStateChange(address(0), 0, true)
        requiresState(IcoState.PAUSED)
        onlymanyowners(keccak256(msg.data))
    {
        m_funds = FundsRegistry(_funds);
    }

    /// @notice set non ether investment controller
    function setNonEtherController(address _controller)
        external
        validAddress(_controller)
        timedStateChange(address(0), 0, true)
        onlymanyowners(keccak256(msg.data))
    {
        m_nonEtherController = _controller;
    }

    function getNonEtherController()
        public
        view
        returns (address)
    {
        return m_nonEtherController;
    }

    /// @notice explicit trigger for timed state changes
    function checkTime()
        public
        timedStateChange(address(0), 0, true)
        onlyowner
    {
    }

    /// @notice send everything to the new (fixed) ico smart contract
    /// @param newICO address of the new smart contract
    function applyHotFix(address newICO)
        public
        validAddress(newICO)
        requiresState(IcoState.PAUSED)
        onlymanyowners(keccak256(msg.data))
    {
        EthPriceDependent next = EthPriceDependent(newICO);
        next.topUp.value(address(this).balance)();
        m_token.transfer(newICO, m_token.balanceOf(this));
        m_token.switchToNextSale(newICO);
    }

    /// @notice withdraw all ether for oraclize payments
    /// @param to Address to send ether to
    function withdrawEther(address to)
        public
        validAddress(to)
        onlymanyowners(keccak256(msg.data))
    {
        to.transfer(address(this).balance);
    }

    /// @notice finishes ICO
    function finishICO()
        public
        timedStateChange(address(0), 0, true)
        requiresState(IcoState.ACTIVE)
        onlymanyowners(keccak256(msg.data))
    {
        finishICOInternal();
    }


    // INTERNAL functions

    function finishICOInternal() private {
        changeState(IcoState.SUCCEEDED);
    }

    /// @dev performs only allowed state transitions
    function changeState(IcoState _newState) private {
        assert(m_state != _newState);

        if (IcoState.INIT == m_state) {
            assert(IcoState.ACTIVE == _newState);
        } else if (IcoState.ACTIVE == m_state) {
            assert(
                IcoState.PAUSED == _newState ||
                IcoState.FAILED == _newState ||
                IcoState.SUCCEEDED == _newState
            );
        } else if (IcoState.PAUSED == m_state) {
            assert(IcoState.ACTIVE == _newState || IcoState.FAILED == _newState);
        } else {
            assert(false);
        }

        m_state = _newState;
        emit StateChanged(m_state);

        // this should be tightly linked
        if (IcoState.SUCCEEDED == m_state) {
            onSuccess();
        } else if (IcoState.FAILED == m_state) {
            onFailure();
        }
    }

    function onSuccess() private {
        // allow owners to withdraw collected ether
        m_funds.changeState(FundsRegistry.State.SUCCEEDED);
        m_funds.detachController();

        // send all remaining tokens to the address responsible for dividing them into pools
        m_token.transfer(m_tokenDistributor, m_token.balanceOf(this));
    }

    function onFailure() private {
        // allow clients to get their ether back
        m_funds.changeState(FundsRegistry.State.REFUNDING);
        m_funds.detachController();
    }


    // FIELDS

    /// @notice token bonuses
    FixedTimeBonuses.Data m_tokenBonuses;

    /// @notice start time of the sale
    uint public m_startTime;

    /// @dev state of the ICO
    IcoState public m_state = IcoState.INIT;

    /// @dev contract responsible for token accounting
    IBoomstarterToken public m_token;

    /// @dev address responsile for allocation of the tokens left if ICO succeeds
    address public m_tokenDistributor;

    /// @dev contract responsible for investments accounting
    FundsRegistry public m_funds;

    /// @dev account handling investments in different currencies
    address public m_nonEtherController;

    /// @dev last recorded funds
    uint public m_lastFundsAmount;

    /// @notice minimum investment in cents
    uint public constant c_MinInvestmentInCents = 500; // $5

    /// @notice token price in cents
    uint public constant c_tokenPriceInCents = 200; // $2

    /// @notice current amount of tokens sold
    uint public m_currentTokensSold;

    /// @dev limit of tokens to be sold during ICO, need to leave 25% for the team
    ///      calculated from the current balance and the total supply
    uint public c_maximumTokensSold;
}
