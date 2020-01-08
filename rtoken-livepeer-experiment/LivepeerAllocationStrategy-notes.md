###Research for LivepeerAllocationStrategy

####Example run through:
For every 10 LPT delegated, 1 LPT is minted each reward call eg 10% inflation per reward.

SC Investor A mint 10 rLPT. investUnderlying() returns 10/1 = 10 (SCA sInternalAmount)  
Reward 0. Total = 11. SCA = 11. Exchange rate = 1.1  
Reward 1. Total = 12.1. SCA = 12.1. Exchange rate = 1.21  
Reward 2. Total = 13.31. SCA = 13.31. Exchange rate = 1.331  
SC Investor B mint 20 rLPT. investUnderlying() returns 20/1.331 = 15.026296018  
Reward 3. Total = 36.641. SCA = 14.641. SCB = 22. Exchange rate = 1.4641  
Reward 4. Total = 40.3051. SCA = 16.1051. SCB = 24.2. Exchange rate = 1.61051  
Reward 5. Total = 44.33561. SCA = 17.71561. SCB = 26.62. Exchange rate = 1.771561  
SC Investor A redeem 10 rLPT. redeemUnderlying(10) returns redeem amount / exchange rate = 10 / 1.771561 = 5.6447393005 (new SCA sInternalAmount = 10 - 5.6447393005 = 4.3552606995)  
Reward 6. Total = 37.769171. SCA = 8.487171. SCB = 29.282. Exchange rate = 1.9487171  

###LivepeerAllocationStrategy interface setup
####underlying()
Returns LPT address.

####exchangeRateStored()
Returns stored exchange rate.

####accrueInterest()
Should call reward() if it hasn’t been called for this round.
And update the exchange rate to:
previous exchange rate + previous exchange rate * (new delegated total / (previous delegated total + minted since previous reward - redeemed since previous reward) - 1)

Actual used:         
currentExchangeRate = (currentExchangeRate + currentExchangeRate * (currentDelegatedTotal * 10**18 / previousDelegatedTotal - 1)) / 10**18; // + minted since previous reward - redeemed since previous reward) - 1);

####investUnderlying()
Returns amount of LPT invested / exchange rate

####redeemUnderlying()
Returns amount of LPT unbonded / exchange rate

If the reward cut is changed on the Transcoder, I think the strategy would need to be updated.
Eg changeAllocationStrategy() would need to be called on the rToken.


####Example with fabricated decimals: 
Decimals: 10**3

SC Investor A mint 10 rLPT (10000). investUnderlying() returns 10000 * 1000 / 1000 = 10000 (SCA sInternalAmount)  
Reward 0. Total = 11000. SCA = 11000. Exchange rate = 1100
  
