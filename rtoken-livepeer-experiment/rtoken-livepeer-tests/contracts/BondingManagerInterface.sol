pragma solidity ^0.5.1;

contract BondingManagerInterface {

    function getDelegator(address _delegator) public view returns
    (
        uint256 bondedAmount,
        uint256 fees,
        address delegateAddress,
        uint256 delegatedAmount,
        uint256 startRound,
        uint256 lastClaimRound,
        uint256 nextUnbondingLockId
    );

    function bond(uint256 _amount, address _to) external;

    function unbond(uint256 _amount) external;

    function claimEarnings(uint256 _endRound) external;

    function withdrawStake(uint256 _unbondingLockId) external;
}
