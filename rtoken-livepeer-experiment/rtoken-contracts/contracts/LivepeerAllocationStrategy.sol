pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "./IAllocationStrategy.sol";

contract LivepeerAllocationStrategy is IAllocationStrategy {

    uint256 exchangeRateStored = 1;

    constructor() public {

    }

    function underlying() external view returns (address) {
        return "0xABCAAaSDC";
    }

    function exchangeRateStored() external view returns (uint256) {
        return exchangeRateStored;
    }

    function accrueInterest() external returns (bool) {
        exchangeRateStored++;
        return true;
    }

    function investUnderlying(uint256 investAmount) external returns (uint256) {
        return 1;
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        return 1;
    }
}
