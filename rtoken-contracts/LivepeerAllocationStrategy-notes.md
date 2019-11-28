###Research for LivepeerAllocationStrategy

####Example run through:
For every 10 LPT delegated, 1 LPT is minted each reward call eg 10% inflation per reward.

SC Investor A mint 10 rLPT. investUnderlying() returns 10/1 = 10 (SCA sInternalAmount)
Reward 0. Total = 11. SCA = 11. Exchange rate = 1.1
Reward 1. Total = 12.1. SCA = 12.1. Exchange rate = 1.21
SC Investor B mint 20 rLPT. investUnderlying() returns 20/1.21 = 16.5289256198
Reward 2. Total = 35.31. SCA = 13.31. SCB = 22. Exchange rate = 1.331
Reward 3. Total = 38.841. SCA = 14.641. SCB = 24.2. Exchange rate = 1.4641
SC Investor A redeem 10 rLPT. redeemUnderlying(10) returns redeem amount / exchange rate = 10 / 1.4641 = 6.8301345537 (new SCA sInternalAmount = 10 - 6.8301345537 = 3.1698654463)
Reward 4. Total = 31.7251. SCA = 5.1051. SCB = 26.62. Exchange rate = 1.61051

###LivepeerAllocationStrategy interface setup
####underlying()
Returns LPT address.

####exchangeRateStored()
Returns stored exchange rate.

####accrueInterest()
Should call reward() if it hasn’t been called for this round.
And update the exchange rate to: previous exchange rate + previous exchange rate * (new delegated total / (previous delegated total + minted since previous reward - redeemed since previous reward) - 1)

####investUnderlying()
Returns amount of LPT invested / exchange rate

####redeemUnderlying()
Returns amount of LPT unbonded / exchange rate
