pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "../../rtoken-contracts/contracts/IAllocationStrategy.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {BondingManagerInterface} from "./BondingManagerInterface.sol";
import {RoundsManagerInterface} from "./RoundsManagerInterface.sol";

// TODO: Consider passing in LivepeerController instead of individual contracts.
contract LivepeerAllocationStrategy is IAllocationStrategy, Ownable {

    uint256 private currentExchangeRate = 10**18;
    uint256 private previousDelegatedTotal = 0;

    IERC20 livepeerToken;
    BondingManagerInterface bondingManager;
    RoundsManagerInterface roundsManager;
    address stakeCapitalTranscoder;

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

    event DEBUG(uint256 a, uint256 b, uint256 c);

    function accrueInterest() external returns (bool) {
        uint256 lastClaimRound;
        (,,,,,lastClaimRound,) = bondingManager.getDelegator(address(this));

        uint256 currentRound = roundsManager.currentRound();
        if (lastClaimRound < currentRound) {
            bondingManager.claimEarnings(roundsManager.currentRound());
        }

        uint256 currentDelegatedTotal;
        (currentDelegatedTotal,,,,,,) = bondingManager.getDelegator(address(this));

        if (previousDelegatedTotal == 0) {
            previousDelegatedTotal = currentDelegatedTotal;
        }

        emit DEBUG(currentExchangeRate, currentDelegatedTotal, previousDelegatedTotal);

        currentExchangeRate = (currentExchangeRate + currentExchangeRate * (currentDelegatedTotal * 10**18 / previousDelegatedTotal - 1)) / 10**18; // + minted since previous reward - redeemed since previous reward) - 1);
        previousDelegatedTotal = currentDelegatedTotal;

        return true;
    }

    function claimEarnings(uint256 _endRound) external {
        bondingManager.claimEarnings(_endRound);
    }

    function investUnderlying(uint256 investAmount) external returns (uint256) {
        bondingManager.bond(investAmount, stakeCapitalTranscoder);
        return investAmount / currentExchangeRate;
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        bondingManager.unbond(redeemAmount);
        return redeemAmount / currentExchangeRate;
    }
}
