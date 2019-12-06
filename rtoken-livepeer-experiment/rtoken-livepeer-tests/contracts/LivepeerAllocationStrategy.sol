pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "../../rtoken-contracts/contracts/IAllocationStrategy.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {BondingManagerInterface} from "./BondingManagerInterface.sol";
import {RoundsManagerInterface} from "./RoundsManagerInterface.sol";

// TODO: Consider passing in LivepeerController instead of individual contracts.
contract LivepeerAllocationStrategy is IAllocationStrategy, Ownable {

    uint256 private constant EXCHANGE_RATE_DECIMALS_MULTIPLIER = 10**18;
    uint256 private currentExchangeRate = EXCHANGE_RATE_DECIMALS_MULTIPLIER;
    uint256 private previousDelegatedTotal = 0;
    uint256 private investedSinceLastAccrue = 0;
    uint256 private redeemedSinceLastAccrue = 0;

    IERC20 livepeerToken;
    BondingManagerInterface bondingManager;
    RoundsManagerInterface roundsManager;
    address stakeCapitalTranscoder;

    event LivepeerAllocationStrategyRedeem(uint256 unbondingLockId);

    constructor(IERC20 _livepeerToken, BondingManagerInterface _bondingManager, RoundsManagerInterface _roundsManager, address _stakeCapitalTranscoder) public {
        livepeerToken = _livepeerToken;
        bondingManager = _bondingManager;
        roundsManager = _roundsManager;
        stakeCapitalTranscoder = _stakeCapitalTranscoder;
    }

    function underlying() external view returns (address) {
        return address(livepeerToken);
    }

    function exchangeRateStored() external view returns (uint256) {
        return currentExchangeRate;
    }

    function accrueInterest() external returns (bool) {
        uint256 lastClaimRound;
        (,,,,,lastClaimRound,) = bondingManager.getDelegator(address(this));

        uint256 currentRound = roundsManager.currentRound();
        if (lastClaimRound < currentRound) {
            bondingManager.claimEarnings(roundsManager.currentRound());
        }

        uint256 currentDelegatedTotal;
        (currentDelegatedTotal,,,,,,) = bondingManager.getDelegator(address(this));

        // TODO: Remove if we can remove need for exchangeRate in investUnderlying() and redeemUnderlying()
        if (currentDelegatedTotal == 0) {
            return true;
        }

        uint256 previousTotalWithoutNewInvestments;
        if (previousDelegatedTotal == 0) {
            previousDelegatedTotal = currentDelegatedTotal;
            previousTotalWithoutNewInvestments = previousDelegatedTotal;
        } else {
            previousTotalWithoutNewInvestments = previousDelegatedTotal + investedSinceLastAccrue - redeemedSinceLastAccrue;
        }

        uint256 interestFactor = currentDelegatedTotal * EXCHANGE_RATE_DECIMALS_MULTIPLIER / previousTotalWithoutNewInvestments - 1;
        currentExchangeRate = (currentExchangeRate + currentExchangeRate * interestFactor) / EXCHANGE_RATE_DECIMALS_MULTIPLIER;

        previousDelegatedTotal = currentDelegatedTotal;
        investedSinceLastAccrue = 0;
        redeemedSinceLastAccrue = 0;

        return true;
    }

    // TODO: Can we determine the return value without the currentExchangeRate so we can remove this.accrueInterest()?
    //     Alternatively end accrueInterest() early if not needed.
    function investUnderlying(uint256 investAmount) external returns (uint256) {
        this.accrueInterest();
        bondingManager.bond(investAmount, stakeCapitalTranscoder);
        investedSinceLastAccrue += investAmount;

        return investAmount * EXCHANGE_RATE_DECIMALS_MULTIPLIER / currentExchangeRate;
    }

    function redeemUnderlying(address owner, uint256 redeemAmount) external returns (uint256) {
        uint256 unbondingLockId;
        (,,,,,,unbondingLockId) = bondingManager.getDelegator(address(this));
        bondingManager.unbond(redeemAmount);
        redeemedSinceLastAccrue += redeemAmount;

        emit LivepeerAllocationStrategyRedeem(unbondingLockId);

        return redeemAmount * EXCHANGE_RATE_DECIMALS_MULTIPLIER / currentExchangeRate;
    }

    function claimEarnings(uint256 _endRound) external {
        bondingManager.claimEarnings(_endRound);
    }

    function withdrawUnbondingLock(uint256 _unbondingLockId) external {
        bondingManager.withdrawStake(_unbondingLockId);

    }
}
