pragma solidity ^0.4.11;

import './Tokensale.sol';

contract LeapPreTokensale is Tokensale {
    function LeapPreTokensale(
        uint256 _startTime,
        address _token,
        address _proxy,
        address _placeholder,
        address _wallet
    ) Tokensale(
        _startTime,
        _token,
        _proxy,
        _placeholder,
        _wallet
    ) {
    }

    function hardcap() public constant returns (uint256) {
        return 86000000e18;
    }

    function duration() public constant returns (uint256) {
        return 14 days;
    }

    function releaseDuration() public constant returns (uint256) {
        return 7 days;
    }

    function rate() public constant returns (uint256) {
        if(leapRaised < 15000000e18) {
            return 4500;
        } else if(leapRaised < 44000000e18) {
            return 4350;
        } else {
            return 4200;
        }
    }

    function forwardFunds(uint256 amount) internal {
        wallet.transfer(amount);
    }
}